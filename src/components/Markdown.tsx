import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* A tiny, safe markdown renderer (no HTML injection): paragraphs, headings,
   bullet/numbered lists, **bold**, *italic* and `code`. Enough for chat replies and tips. */

export function InlineMarkdown({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>)
    const tok = m[0]
    if (tok.startsWith('**')) parts.push(<strong key={i++} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) parts.push(<code key={i++} className="rounded bg-ink/[0.06] px-1 font-mono text-[0.9em]">{tok.slice(1, -1)}</code>)
    else parts.push(<em key={i++}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(<Fragment key={i}>{text.slice(last)}</Fragment>)
  return <>{parts}</>
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  const lines = text.split('\n')
  let list: { ordered: boolean; items: string[] } | null = null
  let para: string[] = []
  let key = 0
  const flushPara = () => {
    if (para.length) blocks.push(<p key={key++}><InlineMarkdown text={para.join(' ')} /></p>)
    para = []
  }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((it, i) => (
      <li key={i}>
        <InlineMarkdown text={it} />
      </li>
    ))
    blocks.push(
      list.ordered ? (
        <ol key={key++} className="list-decimal space-y-1 pl-5 marker:text-ink-faint">{items}</ol>
      ) : (
        <ul key={key++} className="list-disc space-y-1 pl-5 marker:text-accent-ink">{items}</ul>
      ),
    )
    list = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (ul || ol) {
      flushPara()
      const ordered = !!ol
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push((ul ?? ol)![1])
    } else if (h) {
      flushPara()
      flushList()
      blocks.push(<p key={key++} className="font-display text-lg text-ink"><InlineMarkdown text={h[2]} /></p>)
    } else if (!line.trim()) {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return <div className={cn('space-y-2.5', className)}>{blocks}</div>
}
