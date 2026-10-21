import type { Difficulty, Template, TemplateCategory } from '@/types'
import { TEMPLATES, TEMPLATE_MAP } from '@/mocks/templates'
import { hashString } from '@/lib/random'
import { dayKey } from '@/lib/date'
import { ApiError, simulate } from './client'

export interface TemplateQuery {
  category?: TemplateCategory | 'all'
  difficulty?: Difficulty | 'all'
  search?: string
  sort?: 'new' | 'popular' | 'easiest'
}

/** GET /templates — filtering happens client-side in the UI for snappy chips. */
export async function getTemplates(): Promise<Template[]> {
  await simulate({ latency: [300, 700] })
  return TEMPLATES
}

/** GET /templates/:id */
export async function getTemplate(id: string): Promise<Template> {
  await simulate({ latency: [150, 400] })
  const t = TEMPLATE_MAP[id]
  if (!t) throw new ApiError('Template not found', 404, 'not_found')
  return t
}

/** Synchronous lookup for already-loaded templates (thumbnails, labels). */
export function templateById(id: string | undefined): Template | undefined {
  return id ? TEMPLATE_MAP[id] : undefined
}

/** GET /challenges/daily-template — deterministic per local day. Beginner/intermediate only. */
export function dailyTemplateId(date = new Date()): string {
  const pool = TEMPLATES.filter((t) => t.difficulty === 'beginner' || t.difficulty === 'intermediate')
  return pool[hashString(`daily:${dayKey(date)}`) % pool.length].id
}
