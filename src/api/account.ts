import { request, ApiError } from './client'

/** GET /me/export — everything the server keeps about the signed-in user, as a JSON file.
    The server's answer is the file: nothing kept on this device is mixed in (plan UC-25). */
export async function exportData(): Promise<Blob> {
  const payload = await request<unknown>('GET', '/me/export')
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new ApiError('The server sent something we could not read.', 200, 'server_error')
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}
