import type { ArtworkAnalysis } from '@/types'
import { buildScore, computeSubScores, rankForScore } from './scoring'

const grid = (v: number) => Array.from({ length: 9 }, () => Array.from({ length: 12 }, () => v))

const empty: ArtworkAnalysis = {
  coverage: 0,
  spill: 0,
  lineTrace: 0,
  distinctHues: 0,
  dominant: [],
  harmony: 0,
  paletteMatch: 0,
  valueRange: 0,
  saturation: 0,
  inkAmount: 0,
  grid: grid(0),
  strokes: 0,
}

const great: ArtworkAnalysis = {
  coverage: 0.94,
  spill: 0.01,
  lineTrace: 0.8,
  distinctHues: 4,
  dominant: ['#e4572e', '#2f80c4'],
  harmony: 0.85,
  paletteMatch: 0.7,
  valueRange: 0.75,
  saturation: 0.55,
  inkAmount: 0.7,
  grid: grid(0.9),
  strokes: 300,
}

const messy: ArtworkAnalysis = { ...great, spill: 0.2, harmony: 0.3, distinctHues: 9, valueRange: 0.2, saturation: 0.95 }
const half: ArtworkAnalysis = { ...great, coverage: 0.45, grid: grid(0.4) }

describe('scoring heuristics', () => {
  it('gives an empty canvas a very low score', () => {
    const s = buildScore('empty-1', empty)
    expect(s.overall).toBeLessThan(20)
    expect(s.colour).toBeLessThan(5)
    expect(s.rank).toBe('starter')
  })

  it('gives a well-coloured drawing a high score (≥ 85)', () => {
    const s = buildScore('great-1', great)
    expect(s.overall).toBeGreaterThanOrEqual(85)
  })

  it('ranks great > half-done > empty, and great > messy', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const g = buildScore(seed, great).overall
      const h = buildScore(seed, half).overall
      const e = buildScore(seed, empty).overall
      const m = buildScore(seed, messy).overall
      expect(g).toBeGreaterThan(h)
      expect(h).toBeGreaterThan(e)
      expect(g).toBeGreaterThan(m)
    }
  })

  it('is deterministic per artwork id (jitter is seeded)', () => {
    expect(computeSubScores(great, 'x')).toEqual(computeSubScores(great, 'x'))
  })

  it('keeps every sub-score within 0–100', () => {
    for (const a of [empty, great, messy, half]) {
      for (const v of Object.values(computeSubScores(a, 'z'))) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('always returns three tips and a judge note', () => {
    for (const a of [empty, great, messy]) {
      const s = buildScore('t', a)
      expect(s.tips).toHaveLength(3)
      expect(s.judgeNote.en.length).toBeGreaterThan(5)
      expect(s.strengths.length).toBeGreaterThan(0)
    }
  })

  it('maps rank labels to the spec thresholds', () => {
    expect(rankForScore(39)).toBe('starter')
    expect(rankForScore(40)).toBe('rising')
    expect(rankForScore(60)).toBe('steady')
    expect(rankForScore(75)).toBe('gallery')
    expect(rankForScore(90)).toBe('masterpiece')
  })
})
