import type { ChatStreamEvent } from '@/types'
import { parseSSE } from './sse'
import { AiTransportError } from './errors'

const encoder = new TextEncoder()
const body = (...chunks: (string | Uint8Array)[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      controller.close()
    },
  })
const collect = async (stream: ReadableStream<Uint8Array>) => {
  const events: ChatStreamEvent[] = []
  for await (const event of parseSSE(stream)) events.push(event)
  return events
}
it('parses an event split mid-JSON across chunks', async () => {
  expect(
    await collect(
      body(
        'event: token\r\ndata: {"type":"to',
        'ken","text":"hello"}\r',
        '\n\r\n',
        'event: done\ndata: {"type":"done",\ndata: "finish":"completed"}\n\n',
      ),
    ),
  ).toEqual([
    { type: 'token', text: 'hello' },
    { type: 'done', finish: 'completed' },
  ])
})
it('decodes UTF-8 split inside a multi-byte character', async () => {
  const bytes = encoder.encode('data: {"type":"token","text":"Màu sắc"}\n\n')
  const index = bytes.findIndex((byte) => byte > 127)
  expect(await collect(body(bytes.slice(0, index + 1), bytes.slice(index + 1)))).toEqual([{ type: 'token', text: 'Màu sắc' }])
})
it('skips ping comments', async () => {
  expect(await collect(body(': ping\n\n: keepalive\r\n\r\n: ping\ndata: {"type":"status","phase":"thinking"}\n\n'))).toEqual([
    { type: 'status', phase: 'thinking' },
  ])
})
it('ends without done when the body closes early', async () => {
  expect(await collect(body('data: {"type":"token","text":"partial"}\n\ndata: {"type":"done"'))).toEqual([
    { type: 'token', text: 'partial' },
  ])
})
it('rejects a malformed event with protocol', async () => {
  for (const data of ['{', '{"type":"unknown"}', '{"type":"token","text":3}', '{"type":"card"}', '{"type":"card","card":null}']) {
    await expect(collect(body(`data: ${data}\n\n`))).rejects.toBeInstanceOf(AiTransportError)
    await expect(collect(body(`data: ${data}\n\n`))).rejects.toMatchObject({ code: 'protocol' })
  }
})
it('drops a card event that fails card rules and keeps streaming', async () => {
  expect(
    await collect(
      body(
        'event: card\ndata: {"type":"card","card":{"type":"lesson","slug":"not-in-the-app"}}\n\n',
        'data: {"type":"card","card":{"type":"palette","name":"bad","colors":["red"]}}\n\n',
        'data: {"type":"token","text":"continue"}\n\ndata: {"type":"done","finish":"completed"}\n\n',
      ),
    ),
  ).toEqual([
    { type: 'token', text: 'continue' },
    { type: 'done', finish: 'completed' },
  ])
})
it('cancels the reader when the consumer stops early', async () => {
  const cancel = vi.fn()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"token","text":"partial"}\n\n'))
    },
    cancel,
  })
  for await (const event of parseSSE(stream)) {
    expect(event.type).toBe('token')
    break
  }
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(stream.locked).toBe(false)
})
