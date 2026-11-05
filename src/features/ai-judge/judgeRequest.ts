import type { Artwork, Lang, ScoreResult, Template } from '@/types'
import { getImageBlob } from '@/api/artworks'
import { AiTransportError } from '@/api/ai/errors'
import type { JudgeRequest } from '@/api/ai/judgeContract'
import { prepareImage, type PreparedImage } from '@/features/chat/attachments'
import { uid } from '@/lib/random'

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new AiTransportError('image_missing')))
    reader.onerror = () => reject(new AiTransportError('image_missing'))
    reader.readAsDataURL(blob)
  })
}

/** The saved drawing goes out as the same bounded JPEG the chat sends; only formula score fields go with it. */
export async function buildJudgeRequest(artwork: Artwork, template: Template, score: ScoreResult, lang: Lang): Promise<JudgeRequest> {
  const blob = await getImageBlob(artwork.imageKey)
  if (!blob) throw new AiTransportError('image_missing')
  let image: PreparedImage
  try {
    image = await prepareImage(blob, `${template.id}.jpg`)
  } catch {
    throw new AiTransportError('image_missing')
  }
  const { lineAccuracy, composition, proportion, harmony, suitability, aesthetics } = score.sub
  return {
    protocolVersion: 1,
    requestId: uid('j_'),
    lang,
    templateId: template.id,
    image: {
      id: image.id,
      name: image.name,
      mime: 'image/jpeg',
      dataUrl: await readDataUrl(image.analysisBlob),
      width: image.width,
      height: image.height,
      hash: image.hash,
    },
    score: {
      overall: score.overall,
      similarity: score.similarity,
      colour: score.colour,
      rank: score.rank,
      sub: { lineAccuracy, composition, proportion, harmony, suitability, aesthetics },
    },
  }
}
