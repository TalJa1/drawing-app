import type { Artwork, ScoreResult, Template } from '@/types'
import { AiTransportError } from '@/api/ai/errors'
import { AttachmentError } from '@/features/chat/attachments'
import { buildJudgeRequest } from './judgeRequest'

const mocks = vi.hoisted(() => ({ getImageBlob: vi.fn(), prepareImage: vi.fn() }))
vi.mock('@/api/artworks', () => ({ getImageBlob: mocks.getImageBlob }))
vi.mock('@/features/chat/attachments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/chat/attachments')>()),
  prepareImage: mocks.prepareImage,
}))

const sub = { lineAccuracy: 80, composition: 84, proportion: 70, harmony: 52, suitability: 66, aesthetics: 71 }
const score = {
  artworkId: 'art_1',
  similarity: 78,
  colour: 63,
  overall: 71,
  sub: { ...sub, legacy: 9 },
  rank: 'steady',
  strengths: [{ en: 'x', vi: 'x' }],
  weaknesses: [],
  feedback: [],
  tips: [],
  judgeNote: { en: 'note', vi: 'ghi chú' },
  scoredAt: '2026-11-03T08:00:00.000Z',
} as unknown as ScoreResult
const artwork = { id: 'art_1', imageKey: 'img:art_1' } as Artwork
const template = { id: 'fox' } as Template
const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })

beforeEach(() => {
  mocks.getImageBlob.mockReset().mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
  mocks.prepareImage.mockReset().mockResolvedValue({
    id: 'a_1',
    name: 'fox.jpg',
    previewBlob: jpeg,
    analysisBlob: jpeg,
    width: 1200,
    height: 900,
    hash: 'hash_1',
    mime: 'image/jpeg',
  })
})

it('sends the prepared JPEG and only the formula score fields', async () => {
  const request = await buildJudgeRequest(artwork, template, score, 'vi')
  expect(mocks.getImageBlob).toHaveBeenCalledWith('img:art_1')
  expect(mocks.prepareImage).toHaveBeenCalledWith(expect.any(Blob), 'fox.jpg')
  expect(request).toEqual({
    protocolVersion: 1,
    requestId: expect.stringMatching(/^[A-Za-z0-9._-]{1,64}$/),
    lang: 'vi',
    templateId: 'fox',
    image: {
      id: 'a_1',
      name: 'fox.jpg',
      mime: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,/9j/2Q==',
      width: 1200,
      height: 900,
      hash: 'hash_1',
    },
    score: { overall: 71, similarity: 78, colour: 63, rank: 'steady', sub },
  })
})

it('reports a missing or unreadable drawing as image_missing', async () => {
  mocks.getImageBlob.mockResolvedValueOnce(undefined)
  await expect(buildJudgeRequest(artwork, template, score, 'en')).rejects.toEqual(new AiTransportError('image_missing'))
  mocks.prepareImage.mockRejectedValueOnce(new AttachmentError('decode'))
  await expect(buildJudgeRequest(artwork, template, score, 'en')).rejects.toMatchObject({ code: 'image_missing' })
})
