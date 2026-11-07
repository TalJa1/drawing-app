import { byPopularity } from './popularity'

const ids = (list: { id: string }[]) => list.map((x) => x.id)
const T = (id: string) => ({ id })

describe('byPopularity', () => {
  it('puts the template that more people practised first', () => {
    const list = [T('owl'), T('fox'), T('cat')]
    list.sort(byPopularity({ fox: 5, cat: 9, owl: 1 }))
    expect(ids(list)).toEqual(['cat', 'fox', 'owl'])
  })

  it('keeps the order it was given for templates with the same count (the API order)', () => {
    const list = [T('a'), T('b'), T('c'), T('d')]
    list.sort(byPopularity({ a: 2, b: 7, c: 2, d: 7 }))
    expect(ids(list)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('keeps the API order while the numbers have not arrived or have failed', () => {
    const list = [T('c'), T('a'), T('b')]
    list.sort(byPopularity(undefined))
    expect(ids(list)).toEqual(['c', 'a', 'b'])
  })

  it('counts a template the server did not list as 0, below any template with a count', () => {
    const list = [T('new'), T('fox')]
    list.sort(byPopularity({ fox: 1 }))
    expect(ids(list)).toEqual(['fox', 'new'])
  })

  it('does not read a template id as a property of Object (an id like "constructor" counts as 0)', () => {
    const list = [T('a'), T('constructor'), T('toString')]
    list.sort(byPopularity({ a: 1 }))
    expect(ids(list)).toEqual(['a', 'constructor', 'toString'])
  })

  it('treats a value that is not a finite number as 0 instead of breaking the sort', () => {
    const list = [T('a'), T('b'), T('c')]
    list.sort(byPopularity({ a: Number.NaN, b: 3, c: Number.POSITIVE_INFINITY }))
    expect(ids(list)).toEqual(['b', 'a', 'c'])
  })

  it('does not use the editorial `popularity` field of the template', () => {
    const list = [
      { id: 'a', popularity: 99 },
      { id: 'b', popularity: 1 },
    ]
    list.sort(byPopularity({ a: 0, b: 4 }))
    expect(ids(list)).toEqual(['b', 'a'])
  })
})
