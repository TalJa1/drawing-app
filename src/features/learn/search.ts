import type { ArtForm, GlossaryTerm, Lang, Lesson } from '@/types'
import { ARTISTS } from '@/mocks/artists'
import { MOVEMENTS } from '@/mocks/movements'
import { fuzzyIncludes } from '@/lib/utils'

export interface SearchHit {
  kind: 'artForm' | 'movement' | 'artist' | 'lesson' | 'term'
  title: string
  subtitle: string
  to: string
}

/** What the server serves; movements and artists have no endpoint and are still read locally. */
export interface AtlasData {
  artForms: ArtForm[]
  lessons: Lesson[]
  glossary: GlossaryTerm[]
}

/** Global Atlas search across art forms, movements, artists, lessons and glossary terms. */
export function searchAtlas(q: string, lang: Lang, data: AtlasData, limit = 24): SearchHit[] {
  const query = q.trim()
  if (query.length < 2) return []
  const hits: SearchHit[] = []
  const has = (...xs: string[]) => xs.some((x) => fuzzyIncludes(x, query))
  for (const f of data.artForms)
    if (has(f.name.en, f.name.vi, f.definition[lang]))
      hits.push({ kind: 'artForm', title: f.name[lang], subtitle: f.definition[lang], to: `/learn/art-forms/${f.slug}` })
  for (const m of MOVEMENTS)
    if (has(m.name.en, m.name.vi, m.period, m.summary[lang]))
      hits.push({ kind: 'movement', title: m.name[lang], subtitle: `${m.period} · ${m.region[lang]}`, to: `/learn/movements/${m.slug}` })
  for (const a of ARTISTS)
    if (has(a.name, a.nationality[lang], ...a.works.map((w) => w.title[lang])))
      hits.push({ kind: 'artist', title: a.name, subtitle: `${a.years} · ${a.nationality[lang]}`, to: `/learn/artists/${a.slug}` })
  for (const l of data.lessons)
    if (has(l.title.en, l.title.vi, l.summary[lang]))
      hits.push({ kind: 'lesson', title: l.title[lang], subtitle: l.summary[lang], to: `/learn/lessons/${l.slug}` })
  for (const g of data.glossary)
    if (has(g.term.en, g.term.vi))
      hits.push({ kind: 'term', title: g.term[lang], subtitle: g.definition[lang], to: `/learn/glossary?term=${g.id}` })
  return hits.slice(0, limit)
}
