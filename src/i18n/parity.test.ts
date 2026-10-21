import en from './en.json'
import vi from './vi.json'

function keys(o: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('i18n dictionaries', () => {
  it('have exactly the same keys in English and Vietnamese', () => {
    expect(keys(vi).sort()).toEqual(keys(en).sort())
  })

  it('have no empty strings', () => {
    const empty = (o: Record<string, unknown>) => keys(o).filter((k) => {
      const v = k.split('.').reduce<unknown>((acc, p) => (acc as Record<string, unknown>)[p], o)
      return typeof v === 'string' && !v.trim()
    })
    expect(empty(en)).toEqual([])
    expect(empty(vi)).toEqual([])
  })
})
