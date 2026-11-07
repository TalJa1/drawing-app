import type { ArtForm, GlossaryTerm, Lesson } from '@/types'
import { searchAtlas } from './search'

// just the fields the search reads
const artForm = {
  slug: 'watercolour',
  name: { en: 'Watercolour', vi: 'Màu nước' },
  definition: { en: 'Pigment in water on paper.', vi: 'Thuốc màu pha nước.' },
} as ArtForm
const lesson = {
  slug: 'proportion',
  title: { en: 'Proportion', vi: 'Tỷ lệ' },
  summary: { en: 'Compare sizes before details.', vi: 'So kích thước trước chi tiết.' },
} as Lesson
const term = {
  id: 'glaze',
  term: { en: 'Glaze', vi: 'Lớp phủ trong' },
  definition: { en: 'A thin transparent layer.', vi: 'Lớp mỏng trong suốt.' },
} as GlossaryTerm
const data = { artForms: [artForm], lessons: [lesson], glossary: [term] }

describe('searchAtlas', () => {
  it('finds an art form, a lesson and a glossary term from the data it is given', () => {
    expect(searchAtlas('watercolour', 'en', data)).toContainEqual({
      kind: 'artForm',
      title: 'Watercolour',
      subtitle: 'Pigment in water on paper.',
      to: '/learn/art-forms/watercolour',
    })
    expect(searchAtlas('proportion', 'en', data)).toContainEqual({
      kind: 'lesson',
      title: 'Proportion',
      subtitle: 'Compare sizes before details.',
      to: '/learn/lessons/proportion',
    })
    expect(searchAtlas('glaze', 'en', data)).toContainEqual({
      kind: 'term',
      title: 'Glaze',
      subtitle: 'A thin transparent layer.',
      to: '/learn/glossary?term=glaze',
    })
  })

  it('answers in the reader’s language', () => {
    const hit = searchAtlas('tỷ lệ', 'vi', data).find((h) => h.kind === 'lesson')
    expect(hit?.title).toBe('Tỷ lệ')
  })

  it('finds nothing in a list that has not loaded yet, without failing', () => {
    expect(
      searchAtlas('watercolour', 'en', { artForms: [], lessons: [], glossary: [] }).filter(
        (h) => h.kind !== 'movement' && h.kind !== 'artist',
      ),
    ).toEqual([])
  })

  it('needs at least two characters', () => {
    expect(searchAtlas('w', 'en', data)).toEqual([])
    expect(searchAtlas('  ', 'en', data)).toEqual([])
  })

  it('stops at the limit', () => {
    expect(searchAtlas('a', 'en', data)).toEqual([]) // one character: nothing
    const many = { artForms: [], lessons: Array.from({ length: 10 }, (_, i) => ({ ...lesson, slug: `p${i}` })), glossary: [] }
    expect(searchAtlas('proportion', 'en', many, 3)).toHaveLength(3)
  })
})
