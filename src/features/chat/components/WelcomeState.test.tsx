import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomStubs, renderChat } from '../test-utils'
import { WelcomeState } from './WelcomeState'

beforeEach(installDomStubs)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it.each(['ideas', 'colour', 'composition', 'history'] as const)('keeps three usable prompts for %s', async (mode) => {
  const onPrompt = vi.fn()
  await renderChat(<WelcomeState mode={mode} name="Sam" onPrompt={onPrompt} />)
  const prompts = screen.getAllByRole('button')
  expect(prompts).toHaveLength(3)
  for (const prompt of prompts) {
    fireEvent.click(prompt)
    expect(onPrompt).toHaveBeenLastCalledWith(prompt.textContent)
  }
})
