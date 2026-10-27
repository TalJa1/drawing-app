import { vi } from 'vitest'

export function installChatTestStubs() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  class TestURL extends URL {
    static createObjectURL = vi.fn(() => 'blob:chat-image')
    static revokeObjectURL = vi.fn()
  }
  vi.stubGlobal('URL', TestURL)
}
