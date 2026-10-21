/* ------------------------------------------------------------------
   Mock AI judge. Scores are derived from real image heuristics computed
   by the studio (coverage, spill, hue harmony, value range…) plus a little
   seeded jitter, so better drawings genuinely score higher.
   Replace `scoreArtwork` with a call to the real AI scoring endpoint.
   ------------------------------------------------------------------ */
import type { ArtworkAnalysis, Localized, RankLabel, ScoreResult, SubScores } from '@/types'
import { seeded } from '@/lib/random'
import { GENERAL, JUDGE_NOTES, STRENGTHS, TIPS, WEAKNESSES, type SubKey } from '@/mocks/judgeFeedback'
import { useCollection } from '@/store/collection'
import { ApiError, simulate } from './client'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const r1 = (n: number) => Math.round(Math.max(0, Math.min(100, n)))

export function rankForScore(score: number): RankLabel {
  if (score >= 90) return 'masterpiece'
  if (score >= 75) return 'gallery'
  if (score >= 60) return 'steady'
  if (score >= 40) return 'rising'
  return 'starter'
}

function hueVariety(n: number): number {
  if (n <= 0) return 0
  if (n === 1) return 0.45
  if (n === 2) return 0.72
  if (n <= 5) return 1
  if (n === 6) return 0.9
  return 0.8
}

/** Pure scoring function (unit-tested). */
export function computeSubScores(a: ArtworkAnalysis, seed: string): SubScores {
  const rng = seeded(seed)
  const jitter = () => (rng() - 0.5) * 6 // ±3
  const fill = Math.pow(clamp01(a.coverage / 0.92), 0.9)
  const neat = clamp01(1 - a.spill * 4)
  const cells = a.grid.flat().filter((v) => v >= 0)
  const evenness = cells.length ? cells.filter((v) => v > 0.3).length / cells.length : fill
  const presence = clamp01(Math.min(1, a.coverage * 2.2))
  const satBalance = clamp01(1 - Math.abs(a.saturation - 0.55) * 1.6)

  const lineAccuracy = 100 * (0.15 + 0.85 * fill) * (0.6 + 0.4 * neat) + jitter()
  const composition = 100 * (0.2 + 0.8 * fill) * (0.7 + 0.3 * evenness) + jitter()
  const proportion = 100 * (0.25 + 0.75 * fill) * (0.75 + 0.25 * neat) + jitter()
  const harmony = 100 * (0.3 + 0.7 * a.harmony) * presence + jitter()
  const suitability = 100 * (0.35 + 0.65 * (0.5 * a.paletteMatch + 0.5 * hueVariety(a.distinctHues))) * presence + jitter()
  const aesthetics = 100 * (0.3 + 0.35 * a.valueRange + 0.35 * satBalance) * presence + jitter()

  return {
    lineAccuracy: r1(lineAccuracy),
    composition: r1(composition),
    proportion: r1(proportion),
    harmony: r1(harmony),
    suitability: r1(suitability),
    aesthetics: r1(aesthetics),
  }
}

const SIM_KEYS: SubKey[] = ['lineAccuracy', 'composition', 'proportion']
const COL_KEYS: SubKey[] = ['harmony', 'suitability', 'aesthetics']

export function buildScore(artworkId: string, a: ArtworkAnalysis): ScoreResult {
  const sub = computeSubScores(a, artworkId)
  const similarity = r1((sub.lineAccuracy + sub.composition + sub.proportion) / 3)
  const colour = r1((sub.harmony + sub.suitability + sub.aesthetics) / 3)
  const overall = r1(0.55 * similarity + 0.45 * colour)
  const rank = rankForScore(overall)
  const rng = seeded(`${artworkId}:fb`)
  const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)]

  const entries = (Object.keys(sub) as SubKey[]).map((k) => [k, sub[k]] as const)
  const sorted = [...entries].sort((x, y) => y[1] - x[1])
  const strengths: Localized[] = sorted
    .filter(([, v]) => v >= 72)
    .slice(0, 2)
    .map(([k]) => pick(STRENGTHS[k]))
  if (!strengths.length) {
    strengths.push({
      en: 'You showed up and made marks — that’s the hardest step, and you took it.',
      vi: 'Bạn đã bắt tay vào vẽ — đó là bước khó nhất, và bạn đã làm được.',
    })
  }
  const weaknesses: Localized[] = [...sorted]
    .reverse()
    .filter(([, v]) => v < 68)
    .slice(0, 2)
    .map(([k]) => pick(WEAKNESSES[k]))
  // three concrete tips from the weakest areas (always 3, even for great work)
  const tipKeys = [...sorted].reverse().map(([k]) => k)
  const tips: Localized[] = []
  for (const k of tipKeys) {
    for (const tip of TIPS[k]) {
      if (tips.length < 3 && !tips.includes(tip)) tips.push(tip)
      if (tips.length >= 3) break
    }
    if (tips.length >= 3) break
  }
  const simWeak = SIM_KEYS.reduce((m, k) => Math.min(m, sub[k]), 100)
  const colWeak = COL_KEYS.reduce((m, k) => Math.min(m, sub[k]), 100)
  const feedback: Localized[] = [
    pick(GENERAL[rank]),
    simWeak < colWeak
      ? {
          en: 'Your colour sense is ahead of your linework right now — focus on completing and cleaning up the shapes.',
          vi: 'Cảm quan màu sắc của bạn đang đi trước nét vẽ — hãy tập trung hoàn thiện và làm gọn các hình.',
        }
      : {
          en: 'Your shapes are well handled — the biggest gains now will come from colour choices and contrast.',
          vi: 'Các hình được xử lý tốt — tiến bộ lớn nhất lúc này sẽ đến từ lựa chọn màu và độ tương phản.',
        },
  ]

  return {
    artworkId,
    similarity,
    colour,
    overall,
    sub,
    rank,
    strengths,
    weaknesses,
    feedback,
    tips,
    judgeNote: pick(JUDGE_NOTES[rank]),
    scoredAt: new Date().toISOString(),
  }
}

/** POST /artworks/:id/score — the "AI judge". Takes 2.5–4 s like a real model. */
export async function scoreArtwork(artworkId: string): Promise<ScoreResult> {
  await simulate({ latency: [2500, 4000] })
  const art = useCollection.getState().artworks.find((a) => a.id === artworkId)
  if (!art) throw new ApiError('Artwork not found', 404, 'not_found')
  if (!art.analysis) throw new ApiError('Nothing to score', 422, 'missing_analysis')
  const result = buildScore(artworkId, art.analysis)
  useCollection.getState().patch(artworkId, { score: result })
  return result
}
