/* Demo data: fills the collection with sample artworks and a realistic
   history so the app can be previewed populated. Toggle in Profile. */
import type { Artwork, ArtworkAnalysis, GenStyle } from '@/types'
import { seeded } from '@/lib/random'
import { applyEvent } from '@/features/gamification/rules'
import { emptyProgress, type ProgressData } from '@/features/gamification/types'
import { TEMPLATE_MAP } from '@/mocks/templates'
import { STYLE_PALETTES } from '@/components/art/stylePalettes'
import { canvasToBlob, colouriseTemplate, createCanvas, loadSvgImage, makeThumbnail } from '@/lib/raster'
import { useCollection } from '@/store/collection'
import { progressSnapshot, useProgress } from '@/store/progress'
import { useLearn } from '@/store/learn'
import { buildScore } from './scoring'
import { deleteFile, getFile, putFile } from './imageStore'
import { rulesContext } from './progress'
import { simulate } from './client'

const BACKUP_KEY = 'demo:progress-backup'

const PRACTICE: { templateId: string; quality: number; daysAgo: number; hour: number; minutes: number }[] = [
  { templateId: 'sunflower', quality: 0.45, daysAgo: 17, hour: 19, minutes: 14 },
  { templateId: 'fox', quality: 0.58, daysAgo: 15, hour: 20, minutes: 18 },
  { templateId: 'cat', quality: 0.7, daysAgo: 12, hour: 18, minutes: 21 },
  { templateId: 'butterfly', quality: 0.62, daysAgo: 9, hour: 21, minutes: 16 },
  { templateId: 'teapot', quality: 0.8, daysAgo: 6, hour: 10, minutes: 25 },
  { templateId: 'mandala-lotus', quality: 0.86, daysAgo: 5, hour: 22, minutes: 38 },
  { templateId: 'mushroom-house', quality: 0.9, daysAgo: 3, hour: 17, minutes: 33 },
  { templateId: 'koi', quality: 0.78, daysAgo: 2, hour: 20, minutes: 27 },
  { templateId: 'lighthouse', quality: 0.95, daysAgo: 1, hour: 19, minutes: 31 },
]
const FREE: { style: GenStyle; title: string; daysAgo: number }[] = [
  { style: 'impressionist', title: 'Morning Harbour', daysAgo: 14 },
  { style: 'ukiyoe', title: 'Little Wave', daysAgo: 7 },
  { style: 'abstract', title: 'Jazz on Thursday', daysAgo: 4 },
]

function analysisFor(q: number, seed: string): ArtworkAnalysis {
  const rng = seeded(seed)
  const cov = Math.min(0.98, 0.32 + 0.66 * q)
  const grid = Array.from({ length: 9 }, () => Array.from({ length: 12 }, () => Math.max(0, Math.min(1, cov + (rng() - 0.5) * 0.5))))
  return {
    coverage: cov,
    spill: Math.max(0, 0.14 - 0.13 * q),
    lineTrace: 0.4 + 0.5 * q,
    distinctHues: 3 + Math.round(rng() * 3),
    dominant: [],
    harmony: 0.38 + 0.55 * q,
    paletteMatch: 0.3 + 0.55 * q,
    valueRange: 0.35 + 0.5 * q,
    saturation: 0.45 + rng() * 0.2,
    inkAmount: cov * 0.7,
    grid,
    strokes: Math.round(40 + 200 * q),
  }
}

async function rasterise(svg: string, w = 1200, h = 900): Promise<{ image: Blob; thumb: Blob }> {
  const img = await loadSvgImage(svg)
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return { image: await canvasToBlob(c, 'image/png'), thumb: await makeThumbnail(c) }
}

function dateAgo(daysAgo: number, hour: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 12, 0, 0)
  return d
}

export function isDemoActive(): boolean {
  return useCollection.getState().artworks.some((a) => a.demo)
}

/** POST /dev/demo-data */
export async function seedDemoData(): Promise<void> {
  if (isDemoActive()) return
  await simulate({ latency: [400, 800], canFail: false })
  await putFile(BACKUP_KEY, progressSnapshot())
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement } = await import('react')
  const { GenerativeArt } = await import('@/components/art/GenerativeArt')

  let progress: ProgressData = progressSnapshot()
  const artworks: Artwork[] = []
  const events: { at: Date; run: (p: ProgressData, at: Date) => ProgressData }[] = []

  for (const [i, p] of PRACTICE.entries()) {
    const t = TEMPLATE_MAP[p.templateId]
    const id = `demo_practice_${i}`
    const rng = seeded(id)
    const svg = colouriseTemplate(t.svg, t.suggestedPalette, rng, 0.55 + 0.45 * p.quality)
    const { image, thumb } = await rasterise(svg)
    await putFile(`img:${id}`, image)
    await putFile(`thumb:${id}`, thumb)
    const analysis = analysisFor(p.quality, id)
    const score = buildScore(id, analysis)
    const at = dateAgo(p.daysAgo, p.hour)
    artworks.push({
      id,
      kind: 'practice',
      title: t.title.en,
      templateId: t.id,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      timeSpent: p.minutes * 60,
      width: 1200,
      height: 900,
      imageKey: `img:${id}`,
      thumbKey: `thumb:${id}`,
      favourite: i % 4 === 2,
      medium: 'Digital · marker & watercolour',
      analysis,
      score: { ...score, scoredAt: at.toISOString() },
      demo: true,
    })
    events.push({
      at,
      run: (prog, when) =>
        applyEvent(prog, { type: 'artworkScored', score, templateId: t.id, category: t.category, seconds: p.minutes * 60, isDaily: false, distinctHues: analysis.distinctHues }, rulesContext(when)).data,
    })
  }

  for (const [i, f] of FREE.entries()) {
    const id = `demo_free_${i}`
    const svgMarkup = renderToStaticMarkup(createElement(GenerativeArt, { style: f.style, seed: id, palette: STYLE_PALETTES[f.style], grain: false }))
      .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"')
    const { image, thumb } = await rasterise(svgMarkup)
    await putFile(`img:${id}`, image)
    await putFile(`thumb:${id}`, thumb)
    const at = dateAgo(f.daysAgo, 16)
    artworks.push({
      id,
      kind: 'free',
      title: f.title,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      timeSpent: (20 + i * 9) * 60,
      width: 1200,
      height: 900,
      imageKey: `img:${id}`,
      thumbKey: `thumb:${id}`,
      favourite: i === 1,
      medium: 'Digital · free draw',
      demo: true,
    })
    events.push({ at, run: (prog, when) => applyEvent(prog, { type: 'artworkSaved', kind: 'free', seconds: (20 + i * 9) * 60 }, rulesContext(when)).data })
  }

  // a few lessons to round out the history
  const lessons: [string, number][] = [
    ['rule-of-thirds', 11],
    ['hue-value-saturation', 8],
    ['light-and-shadow', 0],
  ]
  for (const [slug, daysAgo] of lessons) {
    const at = dateAgo(daysAgo, 12)
    events.push({ at, run: (prog, when) => applyEvent(prog, { type: 'lessonCompleted', slug, xp: 40 }, rulesContext(when)).data })
    useLearn.getState().setLessonProgress(slug, { progress: 1, completed: true, quizBest: 1, quizPassed: true, lastOpened: at.toISOString() })
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime())
  // demo history is merged on top of the user's real progress
  if (progress.xp === 0 && !Object.keys(progress.badges).length) progress = emptyProgress()
  for (const e of events) progress = e.run(progress, e.at)
  useProgress.getState().replace(progress)
  for (const a of artworks) useCollection.getState().upsert(a)
}

/** DELETE /dev/demo-data */
export async function clearDemoData(): Promise<void> {
  await simulate({ latency: [200, 400], canFail: false })
  const demo = useCollection.getState().artworks.filter((a) => a.demo)
  for (const a of demo) {
    await deleteFile(a.imageKey)
    await deleteFile(a.thumbKey)
  }
  useCollection.getState().removeWhere((a) => !!a.demo)
  const backup = await getFile<ProgressData>(BACKUP_KEY)
  if (backup) useProgress.getState().replace(backup)
  await deleteFile(BACKUP_KEY)
}
