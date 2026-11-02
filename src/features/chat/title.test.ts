import { titleFor } from './title'

test.each([
  ['  Draw\n a   tree  ', 'Draw a tree'],
  ['', ''],
  ['x'.repeat(42), 'x'.repeat(42)],
  ['x'.repeat(43), `${'x'.repeat(40)}…`],
])('title preserves normalization and length for %s', (input, expected) => {
  expect(titleFor(input)).toBe(expected)
})
