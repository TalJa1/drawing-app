import type { Artwork, ArtworkAnalysis, ArtworkKind } from '@/types'
import { uid } from '@/lib/random'
import { useCollection } from '@/store/collection'
import { ApiError, simulate } from './client'
import { deleteFile, fileUrl, forgetUrl, getFile, putFile } from './imageStore'

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
  /** update an existing artwork instead of creating a new one */
  id?: string
}

/** POST /artworks (multipart: image + thumbnail + JSON metadata) */
export async function saveArtwork(req: SaveArtworkRequest): Promise<Artwork> {
  await simulate({ latency: [300, 700], canFail: false })
  const id = req.id ?? uid('art_')
  const now = new Date().toISOString()
  const imageKey = `img:${id}`
  const thumbKey = `thumb:${id}`
  forgetUrl(imageKey)
  forgetUrl(thumbKey)
  await putFile(imageKey, req.image)
  await putFile(thumbKey, req.thumbnail)
  const prev = useCollection.getState().artworks.find((a) => a.id === id)
  const artwork: Artwork = {
    id,
    kind: req.kind,
    title: req.title,
    templateId: req.templateId,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    timeSpent: req.timeSpent,
    width: req.width,
    height: req.height,
    imageKey,
    thumbKey,
    favourite: prev?.favourite ?? false,
    medium: req.medium,
    analysis: req.analysis,
    score: prev?.score,
  }
  useCollection.getState().upsert(artwork)
  return artwork
}

/** Submitting for judging = saving the practice artwork (scoring is a separate call). */
export const submitArtwork = (req: Omit<SaveArtworkRequest, 'kind'>) => saveArtwork({ ...req, kind: 'practice' })

/** GET /artworks */
export async function listArtworks(): Promise<Artwork[]> {
  await simulate({ latency: [200, 500] })
  return [...useCollection.getState().artworks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** GET /artworks/:id */
export async function getArtwork(id: string): Promise<Artwork> {
  await simulate({ latency: [150, 400], canFail: false })
  const a = useCollection.getState().artworks.find((x) => x.id === id)
  if (!a) throw new ApiError('Artwork not found', 404, 'not_found')
  return a
}

/** PATCH /artworks/:id */
export async function updateArtwork(id: string, p: Partial<Pick<Artwork, 'favourite' | 'title'>>): Promise<Artwork> {
  await simulate({ latency: [120, 300], canFail: false })
  useCollection.getState().patch(id, { ...p, updatedAt: new Date().toISOString() })
  return getArtworkSync(id)
}

/** DELETE /artworks/:id */
export async function deleteArtwork(id: string): Promise<void> {
  await simulate({ latency: [200, 400], canFail: false })
  const a = useCollection.getState().artworks.find((x) => x.id === id)
  if (a) {
    forgetUrl(a.imageKey)
    forgetUrl(a.thumbKey)
    await deleteFile(a.imageKey)
    await deleteFile(a.thumbKey)
  }
  useCollection.getState().remove(id)
}

function getArtworkSync(id: string): Artwork {
  const a = useCollection.getState().artworks.find((x) => x.id === id)
  if (!a) throw new ApiError('Artwork not found', 404, 'not_found')
  return a
}

/** GET /artworks/:id/image — returns a URL usable in <img src>. */
export function getImageUrl(key: string): Promise<string | null> {
  return fileUrl(key)
}

export function getImageBlob(key: string): Promise<Blob | undefined> {
  return getFile<Blob>(key)
}
