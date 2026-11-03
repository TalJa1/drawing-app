/* Image & draft storage in IndexedDB (idb-keyval), with an in-memory
   fallback when IndexedDB is unavailable (private mode, tests…).
   A real back-end would upload to object storage and return URLs. */
import { del, get, set, createStore, type UseStore } from 'idb-keyval'

let store: UseStore | null = null
let broken = false
const memory = new Map<string, unknown>()

function db(): UseStore | null {
  if (broken) return null
  try {
    if (typeof indexedDB === 'undefined') {
      broken = true
      return null
    }
    store ??= createStore('artspark', 'files')
    return store
  } catch {
    broken = true
    return null
  }
}

export async function putFile(key: string, value: Blob | string | object): Promise<void> {
  const s = db()
  if (s) {
    try {
      await set(key, value, s)
      return
    } catch {
      broken = true
    }
  }
  memory.set(key, value)
}

export async function getFile<T = Blob>(key: string): Promise<T | undefined> {
  const s = db()
  if (s) {
    try {
      const v = await get<T>(key, s)
      if (v !== undefined) return v
    } catch {
      broken = true
    }
  }
  return memory.get(key) as T | undefined
}

export async function deleteFile(key: string): Promise<void> {
  memory.delete(key)
  const s = db()
  if (s) {
    try {
      await del(key, s)
    } catch {
      /* ignore */
    }
  }
}
