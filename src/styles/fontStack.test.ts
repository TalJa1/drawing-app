import indexHtml from '../../index.html?raw'

/* Georgia (Windows) has no glyph for ề: while the real font was loading, the accent was drawn apart from its letter
   (seen on Chromium 152 / Windows). The splash must not name it. (The font stack of the app itself is checked in
   e2e/motion.spec.ts: the style sheet is not loaded in these unit tests.) */
describe('splash font', () => {
  it('the splash in index.html does not use Georgia, and has a fallback that has the Vietnamese letters', () => {
    const splashFamily = /id="splash"[\s\S]*?font-family:\s*([^;]+);/.exec(indexHtml)?.[1] ?? ''
    expect(splashFamily).not.toBe('')
    expect(splashFamily).not.toMatch(/georgia/i)
    expect(splashFamily).toMatch(/times new roman/i)
  })
})
