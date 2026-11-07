# Art Spark — front-end

A web app for learning to draw and colour. You colour line-art templates and an "AI judge" scores them, you draw freely on a layered canvas, you chat with an art tutor ("the Muse"), you explore an art-history atlas, and you earn XP, streaks, badges and ranks along the way.

This repository contains the **front-end**. The back-end is a separate FastAPI service (accounts, templates, artworks and their images, the AI judge, progress, challenges, the leaderboard, lessons and the data export). Two things are still local: the art tutor ("the Muse") and the movement and artist pages. See [What is on the server, and what is still local](#what-is-on-the-server-and-what-is-still-local).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 (needs the back-end running: Vite forwards /api to http://127.0.0.1:8000)
```

| Script                    | What it does                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`             | Vite dev server with HMR                                                                                                                                                                                                                                                                                                                            |
| `npm run build`           | Type-check (`tsc -b`), then production build to `dist/`                                                                                                                                                                                                                                                                                             |
| `npm run preview`         | Serve the production build                                                                                                                                                                                                                                                                                                                          |
| `npm run lint`            | ESLint (typescript-eslint, React hooks incl. React Compiler rules, react-refresh)                                                                                                                                                                                                                                                                   |
| `npm run format`          | Prettier                                                                                                                                                                                                                                                                                                                                            |
| `npm run gen:api`         | Regenerates `src/api/schema.d.ts` (the back-end's types) from its OpenAPI document at `http://127.0.0.1:8000/openapi.json`                                                                                                                                                                                                                          |
| `npm test`                | Vitest unit tests (scoring, gamification rules, flood fill, image analysis, colour maths, chat intents, i18n key parity)                                                                                                                                                                                                                            |
| `npm run test:e2e`        | Playwright smoke tests (desktop Chrome and Pixel 7). Starts its own dev server on port 5199 and needs the back-end running. Run `npx playwright install chromium` once first                                                                                                                                                                        |
| `npm run test:e2e:layout` | Layout and accessibility specs (`e2e/layout.spec.ts`, `e2e/studio.spec.ts`) in Chromium, WebKit and Firefox. They need no back-end: they replay recorded API responses from `e2e/fixtures/api`. Run `npx playwright install chromium webkit firefox` once first; add `E2E_PREVIEW=1` after `npm run build` to test the production build, as CI does |
| `npm run e2e:fixtures`    | Re-records `e2e/fixtures/api` from a running, freshly seeded back-end (`E2E_RECORD_API`, default `http://127.0.0.1:8000`). Run it when an endpoint changes shape; it registers one throw-away account on that back-end                                                                                                                              |

Environment (see `.env.example`): `VITE_API_BASE` (default `/api/v1`, same origin; set it when the API is on another origin, and the back-end must then list this site in `CORS_ORIGINS`) and, for development only, `VITE_PROXY_TARGET` (default `http://127.0.0.1:8000`). The live browser specs in `e2e-live/` run against a real back-end; see `e2e-live/README.md`.

### Trying it quickly

- **Design system**: `/styleguide` shows the tokens, typography, buttons, frames, form controls, charts and art primitives in both themes.

---

## Tech stack

| Area         | Choice                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build        | Vite 8 (Rolldown), TypeScript strict, path alias `@/` → `src/`                                                                                                 |
| UI           | React 19, Tailwind CSS v4 (CSS-first `@theme`), framer-motion, lucide-react                                                                                    |
| Routing      | react-router-dom 6 data router, lazy route chunks, prefetch on hover/focus                                                                                     |
| Server state | TanStack Query 5 on top of `src/api/*` (`src/api/queries.ts`)                                                                                                  |
| Client state | Zustand 5 with `persist` (localStorage) for preferences and a guest's own progress. Studio drafts go to IndexedDB via `idb-keyval`, with an in-memory fallback |
| Forms        | react-hook-form + zod                                                                                                                                          |
| i18n         | i18next / react-i18next, English + Vietnamese. English is bundled, Vietnamese loads lazily                                                                     |
| Drawing      | A hand-written Canvas 2D engine (`src/features/drawing/engine`), no canvas library                                                                             |
| Tests        | Vitest + Testing Library (jsdom), Playwright (smoke specs in `e2e/`, live specs against a real back-end in `e2e-live/`)                                        |

---

## Folder map

```
src/
  api/            The client for the back-end: one file per domain, plus queries.ts (TanStack hooks) and CONTRACT.md
  app/            Router, route map and lazy loading, app shell, layouts, i18n bootstrap, theme hooks
  components/     Design system: Button, Card, Frame, Modal/Sheet, Tabs, Form, Toaster, charts/, art/, nav/
  features/
    drawing/      engine/ (Engine, brushes, flood fill, analysis), ui/ (stage, tool rail, panels), Studio
    practice/     Template cards, daily challenge, scoring ceremony, result parts
    gamification/ Pure rules (XP, levels, streaks, badges, challenges), celebration host
    learn/        Quiz, art wheel, lesson diagrams, search
    chat/         The Muse, chat cards
    collection/   Artwork image, lightbox
  pages/          One folder per route; pages compose features
  mocks/          Static content that has no endpoint (movements, artists, chat and judge copy) and the local rules a guest uses
  store/          Zustand stores (settings, session, progress, learn, chat, studio, ui)
  i18n/           en.json, vi.json (~1,000 keys each), useL helpers for bilingual content fields
  lib/            Colour maths, seeded random, dates, hooks, raster helpers, confetti, sound
  styles/         tokens.css (pigment palette), textures.css, effects.css
  types/          Shared domain types; these are the API contract types
e2e/              Playwright specs: smoke tests (need the back-end) and the layout / accessibility specs (replay e2e/fixtures/api)
e2e-live/         Playwright specs that run against a real back-end (see its README)
```

---

## Design: "Living Gallery"

- **Tokens are named after pigments**: `--paper`, `--inkwell`, `--vermilion`, `--saffron`, `--cerulean`, `--viridian`, `--rose`, `--gold` and so on, in `src/styles/tokens.css`. Tailwind exposes them through `@theme inline`, for example `bg-paper` and `text-inkwell`.
- **Two themes**: _Atelier_ (warm paper, light) and _Gallery Night_ (dark walls, gallery lighting). The theme is set by `data-theme` on `<html>` and applied before first paint by an inline script in `index.html`. _System_ follows `prefers-color-scheme`.
- **Type**: Fraunces (display, optical size axis), Inter (UI) and Dancing Script (hand-written notes).
- **Signature details**: frames and wall labels around artwork, drifting watercolour washes, ink-bleed button hover, paper fibre texture, gold foil for scores of 85 or more, brush-stroke dividers, a paint-wipe page transition, and an optional custom brush cursor.
- **Charts** (radar, line, calendar heatmap) use a palette checked for colour-vision deficiency, with dashed lines as a second cue and screen-reader tables.

---

## What is on the server, and what is still local

| Area                                                                                                | Where it lives                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts: register, sign in and out, profile (`GET`/`PATCH /me`)                                    | Server (`src/api/auth.ts`)                                                                                                                                                                                                                        |
| Templates, the daily template, how popular each template is                                         | Server (`src/api/templates.ts`)                                                                                                                                                                                                                   |
| Artworks: save, list, edit, delete, image and thumbnail                                             | Server (`src/api/artworks.ts`)                                                                                                                                                                                                                    |
| **AI judge**                                                                                        | Server (`POST /artworks/{id}/score`, `src/api/scoring.ts`). `features/drawing/analysis.ts` still measures the colouring in the browser, and the old local judge (`buildScore`) is kept only as the reference the server's judge is tested against |
| Progress, challenges, achievements, leaderboard                                                     | Server (`src/api/progress.ts`). A guest's activity runs the same rules on the device                                                                                                                                                              |
| Lessons, quizzes, art forms, glossary, bookmarks, flashcards                                        | Server (`src/api/learn.ts`). A guest's learning state stays on the device                                                                                                                                                                         |
| Data export                                                                                         | Server (`GET /me/export`, signed-in users only)                                                                                                                                                                                                   |
| Movements and artists                                                                               | Static content in `src/mocks` (there is no endpoint for them)                                                                                                                                                                                     |
| AI chat (the Muse)                                                                                  | Still local: intent detection (EN and VI, accent-insensitive whole-word matching) feeds templated replies with rich cards. Replies stream token by token through an async generator and can be stopped                                            |
| Drawing engine, studio drafts (IndexedDB), theme, language, sound, reduced motion, onboarding flags | The device                                                                                                                                                                                                                                        |

`src/api/CONTRACT.md` is the reference for every function, its method and path, and its response.

---

## Decisions and deviations

The brief asked me to decide things myself and record them here.

1. **React 19 instead of 18.** It is the current stable release that the toolchain installs. Nothing depends on 19-only APIs except the React Compiler lint rules, which I followed (no ref reads during render, pure renders).
2. **Tailwind v4** (CSS-first configuration) instead of a `tailwind.config.js`. The tokens live in CSS.
3. **No GSAP.** framer-motion plus CSS covers every animation, which keeps one animation runtime in the bundle. All motion respects `prefers-reduced-motion` and the in-app _Motion_ setting (system / reduce / full).
4. **Hand-written drawing engine** instead of Konva or Fabric. It gives full control over brushes, pressure, the flood fill that respects line art, and memory-capped dirty-rectangle history (60 steps, about 180 MB cap).
5. **Template line art is generated SVG** (`src/mocks/templates`). The same SVG drives the studio's line layer, card thumbnails and the "colour regions" used for scoring.
6. **Bilingual content** uses `{ en, vi }` fields in mock data (read with `useL`). UI copy lives in the dictionaries, and a unit test checks that both dictionaries have the same keys.
7. **lucide-react v1 renamed some icons** (`AlertCircle` → `CircleAlert`, `Wand2` → `WandSparkles`, and others). The current names are used.
8. **`@hookform/resolvers` is pinned to v5.** v6 has a peer-dependency conflict with the current react-hook-form.
9. **react-router stays on v6** with the v7 future flags on, so upgrading later is a drop-in change.
10. **Guest-first.** Drawing, learning and the chat work without signing in, and a guest's progress stays on this device. Saving to a collection and being judged need an account: a guest who asks for them is sent to sign in and brought back.

---

## Quality results

| Check                                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit tests                                                      | 475 passing in 34 files (measured 3 Nov 2026)                                                                                                                                                                                                                                                                                                                                                                      |
| Playwright smoke tests (`e2e/`)                                 | 14 passing, 10 skipped (desktop Chrome and Pixel 7; needs the back-end running; measured 3 Nov 2026)                                                                                                                                                                                                                                                                                                               |
| Layout + axe specs (`e2e/layout.spec.ts`, `e2e/studio.spec.ts`) | 411 passing in Chromium, WebKit and Firefox (measured 3 Nov 2026, production build). Every route at 375 / 768 / 1440 px has no sideways scroll; axe (WCAG 2.0/2.1 A + AA) reports 0 violations on 18 visitor routes and 4 signed-in routes at 375 and 1440 px, light theme, Vietnamese. English is checked for 4 routes at 375 px (overflow) and for the home page (axe). Playwright's WebKit is not Safari itself |
| Lighthouse desktop                                              | Home **94**, Practice **97**. Accessibility 100, Best Practices 100, CLS ≤ 0.09                                                                                                                                                                                                                                                                                                                                    |
| Lighthouse mobile (simulated slow 4G, 4× CPU)                   | Home **about 62**, Practice **about 66**. LCP is about 6 s                                                                                                                                                                                                                                                                                                                                                         |

The Lighthouse rows were measured on the production build before the back-end was connected and have not been repeated since.

Continuous integration (`.github/workflows/ci.yml`) runs lint, the unit tests and the production build on every push and pull request, and the layout / accessibility specs once per engine (Chromium, WebKit, Firefox) so that a WebKit-only defect cannot hide behind a Chromium-only run. The smoke specs and `e2e-live/` need a back-end and are not run there.

**Mobile performance does not meet the 90+ target.** The client-rendered SPA has to download and parse React, the router and the motion runtime before it can paint real content. A static splash screen paints immediately, but Lighthouse doesn't count it as LCP. Reaching 90+ on throttled mobile would realistically need pre-rendering or SSR of the landing page (for example Vite SSG or moving to a framework), plus lighter hero art. I did not do that because the brief asked for an SPA.

---

## Talking to the back-end

Pages never call `fetch` directly. They go through **TanStack Query hooks in `src/api/queries.ts`**, which call the functions in `src/api/*`. Every request goes through `request()` in `src/api/client.ts` (Bearer token, 15 s timeout, non-2xx answers become `ApiError(message, status, code)`). The back-end's types come from its OpenAPI document (`npm run gen:api`), and `src/api/contract.ts` checks at compile time that the app's types still fit them.

Besides the static movement and artist pages, the one function that is still local is `chat.streamChatReply`. Connecting it means a `POST /chat` endpoint with streaming, mapping the chunks to `ChatStreamEvent` (`token`, `card`, `done`) and passing the `AbortSignal` through; `detectIntent` and `buildReply` could then be deleted.

---

## Accessibility notes

- Keyboard: every control is reachable, with visible focus rings. The studio has single-key shortcuts (press `?` for the list), and modals and sheets trap focus and close with Esc.
- A skip link, landmark regions and `aria-live` announcements for scores, toasts and chat streaming.
- Colour contrast meets WCAG AA in both themes. Charts have tables and don't rely on colour alone.
- Reduced motion turns off washes, tilt, confetti, page wipes and count-ups.
- Touch: pinch to zoom and two-finger pan on the canvas, 44 px targets, and a mobile tab bar with a bottom-sheet tool panel in the studio.
