import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { getMe } from '@/api/auth'
import { syncLearning } from '@/api/learn'
import { syncProgress } from '@/api/progress'
import { useSession } from '@/store/session'
import { router } from './router'
import { queryClient } from './queryClient'

export function App() {
  // Opening the app signed in: the profile on this device may be older than the account's (changed elsewhere).
  // Failing to reach the server is fine, the profile already shown stays; a 401 signs the person out by itself.
  // The same goes for the learning (lessons, bookmarks, cards) and for the numbers (XP, streak, badges): another
  // device may have changed them.
  useEffect(() => {
    if (!useSession.getState().token) return
    void getMe().catch(() => {})
    void syncLearning().catch(() => {})
    void syncProgress().catch(() => {})
  }, [])
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  )
}
