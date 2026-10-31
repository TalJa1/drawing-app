/* The artworks of the signed-in user, kept on the server (UC-08..UC-11). Nothing is kept on this
   device any more: the list, the facts and the pictures all come from the account. */
import type { Artwork, ArtworkAnalysis, ArtworkKind, RewardSummary } from '@/types'
import { useSession } from '@/store/session'
import type { components } from './schema'
import type { Assert, Wire } from './contract'
import { ApiError, request, requestBlob, requestWithHeaders } from './client'
import { syncProgress } from './progress'

type ArtworkOut = components['schemas']['ArtworkOut']
type ArtworkCreatedOut = components['schemas']['ArtworkCreatedOut']

// The server's shape (from its OpenAPI) and the app's `Artwork` must agree; if one side changes without
// the other, `tsc` fails here. On the wire `kind` is a plain string (the app narrows it), `score` is
// guarded where it is handled (scoring.ts) and `analysis` is a free-form object the server only stores
// (an app interface has no index signature, so it cannot be compared). So: every field the server sends
// is one the app has, and an app artwork can be read as the server's for the rest.
export type ArtworkKeysOnTheWire = Assert<keyof ArtworkOut, keyof Artwork>
export type ArtworkOnTheWire = Assert<Omit<Artwork, 'demo' | 'score' | 'analysis'>, Omit<Wire<ArtworkOut>, 'score' | 'analysis'>>
export type RewardOnTheWire = Assert<Wire<components['schemas']['RewardOut']>, RewardSummary>

export interface SaveArtworkRequest {
  kind: ArtworkKind
  title: string
  templateId?: string
  image: Blob
  thumbnail: Blob
  width: number
  height: number
  timeSpent: number
  medium: string
  analysis?: ArtworkAnalysis
}

export interface SavedArtwork {
  artwork: Artwork
  /**
   * The XP this save paid. Only a NEW free drawing pays on the spot; a practice drawing pays when it is
   * scored, and the same picture sent again pays nothing, so it is absent then.
   */
  reward?: RewardSummary
}

/** POST /artworks (multipart: image + thumbnail + JSON facts) */
export async function saveArtwork(req: SaveArtworkRequest): Promise<SavedArtwork> {
  const meta = {
    kind: req.kind,
    title: req.title,
    templateId: req.templateId,
    width: req.width,
    height: req.height,
    timeSpent: req.timeSpent,
    medium: req.medium,
    analysis: req.analysis,
  }
  const form = new FormData()
  form.append('image', req.image, 'drawing.png')
  form.append('thumbnail', req.thumbnail, 'thumbnail.jpg')
  form.append('meta', JSON.stringify(meta)) // undefined fields are left out by JSON.stringify
  const { reward, ...artwork } = await request<ArtworkCreatedOut>('POST', '/artworks', { form })
  if (reward) await syncProgress().catch(() => {}) // the drawing is saved even if the refresh does not get through
  return { artwork: artwork as Artwork, reward: reward ?? undefined }
}

/** Submitting for judging = saving the practice artwork (scoring is a separate call). */
export const submitArtwork = async (req: Omit<SaveArtworkRequest, 'kind'>): Promise<Artwork> =>
  (await saveArtwork({ ...req, kind: 'practice' })).artwork

/** The most the server gives in one page (GET /artworks?limit=). */
const PAGE_SIZE = 500
/** A list that does not end after this many pages is a server fault, not a very big collection. */
const MAX_PAGES = 100

/** GET /artworks — newest first; every page is read, following the cursor the server hands out. */
export async function listArtworks(): Promise<Artwork[]> {
  const all: Artwork[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const q: string = `?limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const res: { data: Artwork[]; headers: Headers } = await requestWithHeaders<Artwork[]>('GET', `/artworks${q}`)
    all.push(...res.data)
    cursor = res.headers.get('X-Next-Cursor')
    if (!cursor) return all
    if (seen.has(cursor)) break
    seen.add(cursor)
  }
  throw new ApiError('The list of artworks did not end.', 200, 'server_error')
}

/** GET /artworks/:id */
export function getArtwork(id: string): Promise<Artwork> {
  return request<Artwork>('GET', `/artworks/${encodeURIComponent(id)}`)
}

/** PATCH /artworks/:id — only the title and the favourite mark can change. */
export function updateArtwork(id: string, p: Partial<Pick<Artwork, 'favourite' | 'title'>>): Promise<Artwork> {
  return request<Artwork>('PATCH', `/artworks/${encodeURIComponent(id)}`, { body: p })
}

/** DELETE /artworks/:id */
export async function deleteArtwork(id: string): Promise<void> {
  await request<void>('DELETE', `/artworks/${encodeURIComponent(id)}`)
  forget(`/api/v1/artworks/${id}/image`)
  forget(`/api/v1/artworks/${id}/thumb`)
}

/* ---------- pictures ----------
   The server gives a picture only to its owner, and an <img src> cannot send the token. So the bytes
   are fetched here with the token and shown from an object URL. Each picture is fetched once (the
   same one is wanted by a card and by the lightbox) and let go of when the user signs out. */

/** `imageKey` / `thumbKey` as the server writes them. Only these are ever fetched with the token. */
const PICTURE_KEY = /^\/api\/v1(\/artworks\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:image|thumb))$/i

const blobs = new Map<string, Promise<Blob>>()
const urls = new Map<string, string>()
let generation = 0

function blobOf(key: string): Promise<Blob> | null {
  const path = PICTURE_KEY.exec(key)?.[1]
  if (!path) return null
  let p = blobs.get(key)
  if (!p) {
    p = requestBlob(path)
    blobs.set(key, p)
    p.catch(() => {
      if (blobs.get(key) === p) blobs.delete(key) // a failure is not remembered: the next look tries again
    })
  }
  return p
}

function forget(key: string): void {
  blobs.delete(key)
  const u = urls.get(key)
  if (u) URL.revokeObjectURL(u)
  urls.delete(key)
}

/** Lets go of every picture held in memory. */
export function clearImageCache(): void {
  generation++
  for (const u of urls.values()) URL.revokeObjectURL(u)
  urls.clear()
  blobs.clear()
}

// another person (or nobody) is now signed in: nothing of the previous one stays in memory
useSession.subscribe((s, prev) => {
  if (s.token !== prev.token) clearImageCache()
})

/** GET /artworks/:id/image | thumb — returns a URL usable in <img src>, or null for a key that is not ours. */
export async function getImageUrl(key: string): Promise<string | null> {
  const p = blobOf(key)
  if (!p) return null
  const gen = generation
  const blob = await p
  if (gen !== generation) return null // the user changed while it loaded
  let url = urls.get(key)
  if (!url) {
    url = URL.createObjectURL(blob)
    urls.set(key, url)
  }
  return url
}

/** The picture itself (for a download or the chat), or undefined for a key that is not ours. */
export async function getImageBlob(key: string): Promise<Blob | undefined> {
  return (await blobOf(key)) ?? undefined
}

/* ---------- what to tell the person when it fails ---------- */

/** Codes of the artwork and scoring endpoints that have a sentence of their own (src/i18n `errors.api.*`). */
export const API_ERROR_CODES = [
  'template_locked',
  'rate_limited',
  'payload_too_large',
  'unsupported_media_type',
  'not_found',
  'missing_analysis',
  'not_scorable',
  'scoring_not_configured',
  'unauthorized',
  'network_error',
  'timeout',
  'service_unavailable',
] as const

/** A gateway in front of the API that cannot reach it answers 502/503/504 (not our envelope). */
const GATEWAY_DOWN = new Set([502, 503, 504])

/** The i18n key of what to tell the person (the server's own text is English only, so it is not shown). */
export function apiErrorKey(e: unknown): string {
  if (!(e instanceof ApiError)) return 'common.errorGeneric'
  if (GATEWAY_DOWN.has(e.status)) return 'errors.api.service_unavailable'
  return (API_ERROR_CODES as readonly string[]).includes(e.code) ? `errors.api.${e.code}` : 'common.errorGeneric'
}
