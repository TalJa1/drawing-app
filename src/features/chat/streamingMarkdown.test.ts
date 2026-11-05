import { closeDangling, splitStable } from './streamingMarkdown'

it('splitStable cuts at the last blank line', () => {
  expect(splitStable('First.\n\nSecond.\n\nPartial **bold')).toEqual({ stable: 'First.\n\nSecond.\n\n', tail: 'Partial **bold' })
  expect(splitStable('No blank line')).toEqual({ stable: '', tail: 'No blank line' })
})
it('closeDangling closes ** and backticks', () => {
  expect(closeDangling('Try **bold')).toBe('Try **bold**')
  expect(closeDangling('Use `pencil')).toBe('Use `pencil`')
  expect(closeDangling('**done** and `done`')).toBe('**done** and `done`')
  expect(closeDangling('Try **bold `code')).toBe('Try **bold `code`**')
  expect(closeDangling('* Draw a tree')).toBe('* Draw a tree')
})
