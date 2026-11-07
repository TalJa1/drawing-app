import type { Template } from '@/types'
import type { components } from './schema'
import type { Assert, Wire } from './contract'
import { request } from './client'

// The server's shape (from its OpenAPI) must be usable as the app's `Template`; if one side changes
// without the other, `tsc` fails here.
export type TemplateOnTheWire = Assert<Wire<components['schemas']['TemplateOut']>, Template>

/** How many different people practised each template lately (GET /template-popularity). */
export interface TemplatePopularity {
  windowDays: number
  /** When the server counted, as an ISO date-time in UTC. */
  asOf: string
  /** Every template of the server's list: id -> number of people. A template nobody practised is 0. */
  counts: Record<string, number>
}
export type TemplatePopularityOnTheWire = Assert<Wire<components['schemas']['TemplatePopularityOut']>, TemplatePopularity>

/** GET /templates — filtering happens client-side in the UI for snappy chips. */
export function getTemplates(): Promise<Template[]> {
  return request<Template[]>('GET', '/templates')
}

/** GET /templates/{id} */
export function getTemplate(id: string): Promise<Template> {
  return request<Template>('GET', `/templates/${encodeURIComponent(id)}`)
}

/**
 * GET /challenges/daily-template — the template of the day. The server decides it (it is also the
 * one that credits the "template of the day" challenge, from the day a drawing is saved, in the
 * caller's time zone), so the app asks instead of keeping a second copy of the rule.
 */
export async function getDailyTemplateId(): Promise<string> {
  const res = await request<{ templateId: string }>('GET', '/challenges/daily-template')
  return res.templateId
}

/**
 * GET /template-popularity — people who practised each template in the last `windowDays` days.
 * Public. The server keeps the numbers for minutes, so asking often costs nothing.
 */
export function getTemplatePopularity(): Promise<TemplatePopularity> {
  return request<TemplatePopularity>('GET', '/template-popularity')
}
