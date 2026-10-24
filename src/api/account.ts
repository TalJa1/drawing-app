import { useCollection } from '@/store/collection'
import { useProgress } from '@/store/progress'
import { useLearn } from '@/store/learn'
import { useChat } from '@/store/chat'
import { useSession, GUEST } from '@/store/session'
import { useSettings } from '@/store/settings'
import { STORE_KEYS } from '@/store/storage'
import { simulate } from './client'
import { deleteFile, listKeys } from './imageStore'

/** GET /me/export — everything we know about you, as JSON. */
export async function exportData(): Promise<Blob> {
  await simulate({ latency: [300, 600], canFail: false })
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'Art Spark',
    user: useSession.getState().user,
    settings: {
      theme: useSettings.getState().theme,
      language: useSettings.getState().language,
      motion: useSettings.getState().motion,
      drawing: useSettings.getState().drawing,
    },
    artworks: useCollection.getState().artworks,
    // JSON.stringify drops the stores' action functions
    progress: useProgress.getState(),
    learning: useLearn.getState(),
    conversations: useChat.getState().conversations,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

/** DELETE /me — wipes all local data (images, drafts, stores). */
export async function deleteAllData(): Promise<void> {
  await simulate({ latency: [400, 800], canFail: false })
  for (const k of await listKeys()) await deleteFile(k)
  useCollection.getState().clear()
  useProgress.getState().reset()
  useLearn.getState().reset()
  useChat.getState().reset()
  useSession.setState({ user: GUEST, token: null })
  try {
    for (const k of Object.values(STORE_KEYS)) if (k !== STORE_KEYS.settings) localStorage.removeItem(k)
  } catch {
    /* storage blocked — in-memory state already cleared */
  }
}
