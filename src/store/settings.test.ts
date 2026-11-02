import { useSettings } from './settings'

describe('stored settings', () => {
  const opts = () => useSettings.persist.getOptions()

  it('drops the old "simulate server hiccups" flag a previous version may have saved', () => {
    const old = { theme: 'dark', language: 'vi', simulateErrors: true, drawing: { defaultTool: 'brush', pressure: false, smoothing: 0.5 } }
    expect(opts().version).toBe(3)

    const migrated = opts().migrate?.(old, 2) as Record<string, unknown>

    expect(migrated).not.toHaveProperty('simulateErrors')
    // everything else the person chose stays
    expect(migrated).toMatchObject({ theme: 'dark', language: 'vi', drawing: { defaultTool: 'brush', pressure: false, smoothing: 0.5 } })
  })

  it('still resets the old default smoothing of a version-1 save, and drops the flag in the same pass', () => {
    const old = { simulateErrors: false, drawing: { defaultTool: 'pencil', pressure: true, smoothing: 0.35 } }

    const migrated = opts().migrate?.(old, 1) as Record<string, unknown>

    expect(migrated).not.toHaveProperty('simulateErrors')
    expect(migrated.drawing).toMatchObject({ smoothing: 0 })
  })

  it('has no such flag in a fresh state', () => {
    expect(useSettings.getState()).not.toHaveProperty('simulateErrors')
    expect(useSettings.getState()).not.toHaveProperty('setSimulateErrors')
  })
})
