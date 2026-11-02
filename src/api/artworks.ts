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
export type ArtworkOnTheWire = Assert<Omit<Artwork, 'score' | 'analysis'>, Omit<Wire<ArtworkOut>, 'score' | 'analysis'>>
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
   same one is wanted by a card and by the lightbox).

   Memory: a picture's bytes stay in memory for as long as its object URL exists. So the pictures
   nobody is showing are kept only up to a ceiling; beyond it the one looked at longest ago is let go
   (it is simply fetched again if it is wanted later). A picture that IS being shown is never let go,
   so the ceiling is for what is not on screen, not a hard limit on the whole page. Everything is let
   go when the person signs out. */

/**
 * The most bytes of pictures nobody is showing that are kept in memory. 64 MiB is a choice, not a
 * measurement: a thumbnail weighed about 0.4 MB and a full picture about 1.5 MB in the one drawing
 * measured, so this holds on the order of 150 thumbnails. Pictures on screen do not count against it.
 */
export const IMAGE_CACHE_LIMIT_BYTES = 64 * 1024 * 1024

/** `imageKey` / `thumbKey` as the server writes them. Only these are ever fetched with the token. */
const PICTURE_KEY = /^\/api\/v1(\/artworks\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:image|thumb))$/i

interface Picture {
  bytes: Promise<Blob>
  /** 0 until the bytes have arrived (a picture on its way cannot be let go: its size is not known yet) */
  size: number
  /** how many places are showing it right now */
  shown: number
  url?: string
}

/** In the order they were last wanted: the first one is the one wanted longest ago. */
const pictures = new Map<string, Picture>()
let limit = IMAGE_CACHE_LIMIT_BYTES
let generation = 0

/** Changes the ceiling (tests, or tuning for a small device). */
export function setImageCacheLimit(bytes: number): void {
  limit = bytes
  trim()
}

function dropPicture(key: string, p: Picture): void {
  pictures.delete(key)
  if (p.url) URL.revokeObjectURL(p.url)
}

/** Lets go of pictures nobody is showing, the one wanted longest ago first, until the rest fit. */
function trim(): void {
  let total = 0
  for (const p of pictures.values()) total += p.size
  for (const [key, p] of pictures) {
    if (total <= limit) return
    if (p.shown > 0 || p.size === 0) continue
    total -= p.size
    dropPicture(key, p)
  }
}

function pictureOf(key: string): Picture | null {
  const path = PICTURE_KEY.exec(key)?.[1]
  if (!path) return null
  const held = pictures.get(key)
  if (held) {
    pictures.delete(key) // wanted again: it moves to the end of the line
    pictures.set(key, held)
    return held
  }
  const fresh: Picture = { bytes: requestBlob(path), size: 0, shown: 0 }
  pictures.set(key, fresh)
  fresh.bytes.then(
    (blob) => {
      if (pictures.get(key) !== fresh) return // let go (signed out, deleted) while it was on its way
      fresh.size = blob.size
      trim()
    },
    () => {
      if (pictures.get(key) === fresh) pictures.delete(key) // a failure is not remembered: the next look tries again
    },
  )
  return fresh
}

function forget(key: string): void {
  const p = pictures.get(key)
  if (p) dropPicture(key, p)
}

/** Lets go of every picture held in memory. */
export function clearImageCache(): void {
  generation++
  for (const p of pictures.values()) if (p.url) URL.revokeObjectURL(p.url)
  pictures.clear()
}

// another person (or nobody) is now signed in: nothing of the previous one stays in memory
useSession.subscribe((s, prev) => {
  if (s.token !== prev.token) clearImageCache()
})

/** A picture shown on screen. Call `release` when it is no longer shown (it may then be let go of). */
export interface ImageLease {
  url: string
  release: () => void
}

/**
 * GET /artworks/:id/image | thumb — a URL usable in <img src>, held for as long as the lease is not
 * released. Returns null for a key that is not ours, or when the person changed while it loaded.
 */
export async function acquireImage(key: string): Promise<ImageLease | null> {
  const p = pictureOf(key)
  if (!p) return null
  p.shown++ // counted before the wait, so it cannot be let go of between arriving and being shown
  const gen = generation
  let released = false
  const release = () => {
    if (released) return
    released = true
    p.shown--
    if (p.shown === 0) trim()
  }
  let blob: Blob
  try {
    blob = await p.bytes
  } catch (e) {
    release()
    throw e
  }
  if (gen !== generation || pictures.get(key) !== p) {
    release()
    return null // the user changed, or the picture was let go of (deleted), while it loaded
  }
  p.url ??= URL.createObjectURL(blob)
  return { url: p.url, release }
}

/** The picture itself (for a download or the chat), or undefined for a key that is not ours. Holds nothing on screen. */
export async function getImageBlob(key: string): Promise<Blob | undefined> {
  return (await pictureOf(key)?.bytes) ?? undefined
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
