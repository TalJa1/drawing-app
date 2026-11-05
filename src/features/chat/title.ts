/** Suggest a short conversation title from the first message. */
export function titleFor(message: string): string {
  const t = message.replace(/\s+/g, ' ').trim()
  return t.length > 42 ? `${t.slice(0, 40)}…` : t
}
