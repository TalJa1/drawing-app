export function splitStable(text: string): { stable: string; tail: string } {
  const index = text.lastIndexOf('\n\n')
  return index < 0 ? { stable: '', tail: text } : { stable: text.slice(0, index + 2), tail: text.slice(index + 2) }
}

export function closeDangling(tail: string): string {
  const open: string[] = []
  for (const token of tail.match(/\*\*|`/g) ?? []) {
    if (open.at(-1) === '`' && token !== '`') continue
    if (open.at(-1) === token) open.pop()
    else open.push(token)
  }
  return tail + open.reverse().join('')
}
