import { cleanup, screen } from '@testing-library/react'
import { useChat } from '@/store/chat'
import { installDomStubs, renderChat } from '../test-utils'
import { ConversationList } from './ConversationList'

beforeEach(() => {
  installDomStubs()
  useChat.getState().reset()
})
afterEach(() => {
  cleanup()
  useChat.getState().reset()
  vi.unstubAllGlobals()
})

it('keeps the complete title accessible alongside its mode and date', async () => {
  const id = useChat.getState().create('colour')
  const title = 'Afternoon drawing study and colour choices to remember for my next landscape'
  useChat.getState().rename(id, title)
  await renderChat(<ConversationList />)
  const button = screen.getByRole('button', { name: new RegExp(title) })
  expect(button).toHaveTextContent('Colour')
  expect(button).toHaveTextContent(String(new Date().getFullYear()))
})
