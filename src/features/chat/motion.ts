import { useSyncExternalStore } from 'react'
import type { Variants } from 'framer-motion'

export const CHAT_MOTION = {
  welcome: 0.425,
  welcomeStagger: 0.06,
  idle: 6.5,
  focus: 0.16,
  prompt: 0.17,
  mode: 0.21,
  attachment: 0.21,
  attachmentExit: 0.16,
  bubble: 0.21,
  sendStop: 0.15,
  connecting: 2.4,
  preparing: 0,
  tokenFlush: 0.04,
  card: 0.26,
  cardStagger: 0.05,
  swatch: 0.2,
  copy: 0.14,
  copyReset: 1.2,
  critique: 0.24,
  finish: 0.17,
  stop: 0.15,
  error: 0.2,
  sheet: 0.25,
  threadSwap: 0.15,
  scrollButton: 0.16,
} as const

export function chatVariants(
  reduced: boolean,
): Record<'prompt' | 'bubble' | 'card' | 'swatch' | 'attachment' | 'sheet' | 'threadSwap' | 'scrollButton', Variants> {
  const enter = (duration: number, y = 0, x = 0, scale = 1): Variants =>
    reduced
      ? {
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.08 } },
          exit: { opacity: 0, transition: { duration: 0.08 } },
        }
      : {
          hidden: { opacity: 0, y, x, scale },
          visible: { opacity: 1, y: 0, x: 0, scale: 1, transition: { duration } },
          exit: { opacity: 0, y, x, scale, transition: { duration: CHAT_MOTION.attachmentExit } },
        }
  return {
    prompt: enter(CHAT_MOTION.prompt, 3),
    bubble: enter(CHAT_MOTION.bubble, 8),
    card: enter(CHAT_MOTION.card, 10, 0, 0.98),
    swatch: enter(CHAT_MOTION.swatch, 0, 0, 0.96),
    attachment: enter(CHAT_MOTION.attachment, 0, 0, 0.95),
    sheet: enter(CHAT_MOTION.sheet, 0, -24),
    threadSwap: reduced
      ? enter(0.08)
      : { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: CHAT_MOTION.threadSwap } } },
    scrollButton: enter(CHAT_MOTION.scrollButton, 4),
  }
}

const subscribeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}
export function useChatVisibility(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => !document.hidden,
    () => true,
  )
}
