# Art Spark — front-end

A web app for learning to draw and colour. You colour line-art templates and an "AI judge" scores them, you draw freely on a layered canvas, you chat with an art tutor ("the Muse"), you explore an art-history atlas, and you earn XP, streaks, badges and ranks along the way.

This repository contains **only the front-end**. Every back-end behaviour (auth, storage, AI scoring, AI chat, leaderboards) is simulated behind `src/api/*`, which has the same signatures a real service would expose. See [How to connect the real back-end](#how-to-connect-the-real-back-end).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script             | What it does                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`      | Vite dev server with HMR                                                                                                                      |
| `npm run build`    | Type-check (`tsc -b`), then production build to `dist/`                                                                                       |
| `npm run preview`  | Serve the production build                                                                                                                    |
| `npm run lint`     | ESLint (typescript-eslint, React hooks incl. React Compiler rules, react-refresh)                                                             |
| `npm run format`   | Prettier                                                                                                                                      |
| `npm test`         | Vitest unit tests (scoring, gamification rules, flood fill, image analysis, colour maths, chat intents, i18n key parity)                      |
| `npm run test:e2e` | Playwright smoke tests (desktop Chrome and Pixel 7). Starts its own dev server on port 5199. Run `npx playwright install chromium` once first |

Optional environment variable: `VITE_API_BASE` (default `/api`). Only the future real client reads it.

### Trying it quickly

- **Demo data**: go to _Profile → Settings → Demo data_, or press _Preview with demo artworks_ on the empty Collection page. This seeds 12 artworks (9 scored practice pieces spread over the last ~2½ weeks, 3 free drawings), XP, a streak and badges so every chart and gallery has content. Turning the switch off removes exactly what it added.
- **Simulated failures**: _Profile → Settings → Simulate server hiccups_ makes about 20% of mock requests fail, so you can see every error and retry state.
- **Design system**: `/styleguide` shows the tokens, typography, buttons, frames, form controls, charts and art primitives in both themes.

---

## Tech stack

| Area         | Choice                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Build        | Vite 8 (Rolldown), TypeScript strict, path alias `@/` → `src/`                                                          |
| UI           | React 19, Tailwind CSS v4 (CSS-first `@theme`), framer-motion, lucide-react                                             |
| Routing      | react-router-dom 6 data router, lazy route chunks, prefetch on hover/focus                                              |
| Server state | TanStack Query 5 on top of `src/api/*` (`src/api/queries.ts`)                                                           |
| Client state | Zustand 5 with `persist` (localStorage). Images and drafts go to IndexedDB via `idb-keyval`, with an in-memory fallback |
| Forms        | react-hook-form + zod                                                                                                   |
| i18n         | i18next / react-i18next, English + Vietnamese. English is bundled, Vietnamese loads lazily                              |
| Drawing      | A hand-written Canvas 2D engine (`src/features/drawing/engine`), no canvas library                                      |
| Tests        | Vitest + Testing Library (jsdom), Playwright + axe-core                                                                 |

---

## Folder map

```
src/
  api/            Mock "server": one file per domain, plus queries.ts (TanStack hooks) and CONTRACT.md
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
  mocks/          Seed content: 27 SVG templates, 46 badges, challenges, 31 movements, 33 artists,
                  20 art forms, 26 lessons, ~72 glossary terms, palettes, chat and judge copy
  store/          Zustand stores (settings, session, progress, collection, learn, chat, studio, ui)
  i18n/           en.json, vi.json (~1,000 keys each), useL helpers for bilingual content fields
  lib/            Colour maths, seeded random, dates, hooks, raster helpers, confetti, sound
  styles/         tokens.css (pigment palette), textures.css, effects.css
  types/          Shared domain types; these are the API contract types
e2e/              Playwright smoke tests
```

---

## Design: "Living Gallery"

- **Tokens are named after pigments**: `--paper`, `--inkwell`, `--vermilion`, `--saffron`, `--cerulean`, `--viridian`, `--rose`, `--gold` and so on, in `src/styles/tokens.css`. Tailwind exposes them through `@theme inline`, for example `bg-paper` and `text-inkwell`.
- **Two themes**: _Atelier_ (warm paper, light) and _Gallery Night_ (dark walls, gallery lighting). The theme is set by `data-theme` on `<html>` and applied before first paint by an inline script in `index.html`. _System_ follows `prefers-color-scheme`.
- **Type**: Fraunces (display, optical size axis), Inter (UI) and Dancing Script (hand-written notes).
- **Signature details**: frames and wall labels around artwork, drifting watercolour washes, ink-bleed button hover, paper fibre texture, gold foil for scores of 85 or more, brush-stroke dividers, a paint-wipe page transition, and an optional custom brush cursor.
- **Charts** (radar, line, calendar heatmap) use a palette checked for colour-vision deficiency, with dashed lines as a second cue and screen-reader tables.

---

## What is simulated, and how

| Feature         | Simulation                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network         | `simulate()` in `src/api/client.ts` adds 300–1500 ms latency and optional random failures (`ApiError`)                                                                                                                                                                                                                                                                                                                                                                        |
| Auth            | Any email and password of 6+ characters works. The user is stored in localStorage. Guests can use everything                                                                                                                                                                                                                                                                                                                                                                  |
| Artwork storage | Metadata in a Zustand store, image blobs in IndexedDB                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **AI judge**    | Heuristic, not random. `features/drawing/analysis.ts` measures the colouring: coverage of each region, spill outside the lines, hue variety, colour harmony, match with the suggested palette, value range, and evenness across a grid. `api/scoring.ts` turns those measurements into sub-scores, an overall score, a rank, strengths and tips, plus a small seeded jitter. An empty canvas scores low, careful colouring scores high, and 85+ triggers the gold celebration |
| AI chat         | Intent detection (EN and VI, accent-insensitive whole-word matching) feeds templated replies with rich cards (palettes, templates, lessons, artworks). Replies stream token by token through an async generator and can be stopped                                                                                                                                                                                                                                            |
| Leaderboard     | 20 sample artists, with you merged in at your real XP                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Daily challenge | A deterministic template per calendar day                                                                                                                                                                                                                                                                                                                                                                                                                                     |

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
10. **Guest-first.** Login is optional and progress is kept locally. A real back-end would merge guest progress into the account at sign-up (see the checklist).

---

## Quality results (measured locally on the production build)

| Check                                         | Result                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| Unit tests                                    | 50 passing                                                                      |
| Playwright smoke tests                        | 6 passing (2 desktop-only flows skipped on mobile)                              |
| axe-core (11 key pages, both themes)          | 0 serious or moderate violations                                                |
| Lighthouse desktop                            | Home **94**, Practice **97**. Accessibility 100, Best Practices 100, CLS ≤ 0.09 |
| Lighthouse mobile (simulated slow 4G, 4× CPU) | Home **about 62**, Practice **about 66**. LCP is about 6 s                      |

**Mobile performance does not meet the 90+ target.** The client-rendered SPA has to download and parse React, the router and the motion runtime before it can paint real content. A static splash screen paints immediately, but Lighthouse doesn't count it as LCP. Reaching 90+ on throttled mobile would realistically need pre-rendering or SSR of the landing page (for example Vite SSG or moving to a framework), plus lighter hero art. I did not do that because the brief asked for an SPA.

---

## How to connect the real back-end

Pages never call `fetch` directly. They go through **TanStack Query hooks in `src/api/queries.ts`**, which call the functions below. To go live:

1. Create a real HTTP client in `src/api/client.ts` (base URL `API_BASE`, auth header, JSON parsing, mapping non-2xx responses to `ApiError(message, status, code)`). Delete `simulate()` once nothing uses it.
2. Replace each function body below with a request. **Keep the signatures and return types** (they are defined in `src/types` and documented in `src/api/CONTRACT.md`). The UI, caching and invalidation then keep working unchanged.
3. Move anything persisted in Zustand stores that is really server state (artworks, progress, learn progress, chat history) to query data. Keep only UI preferences (`settings`, `studio`, `ui`) local.
4. Tick each row as you go:

| ☐   | Function (`src/api/…`)                                                                                                                        | Used by                                     | Real service                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☐   | `auth.login` / `auth.register`                                                                                                                | `/login`, `/register`                       | `POST /auth/login`, `POST /auth/register` → `{ user, token }`. Store the token (httpOnly cookie preferred). On register, **merge guest progress**                                                                                                                |
| ☐   | `auth.logout`                                                                                                                                 | Navbar, Profile                             | `POST /auth/logout`                                                                                                                                                                                                                                              |
| ☐   | `auth.updateProfile`                                                                                                                          | Profile                                     | `PATCH /me`                                                                                                                                                                                                                                                      |
| ☐   | `templates.getTemplates` / `getTemplate`                                                                                                      | `/practice`, studio, home                   | `GET /templates`, `GET /templates/:id` (SVG line art + regions + palette)                                                                                                                                                                                        |
| ☐   | `templates.dailyTemplateId`                                                                                                                   | Daily challenge banner                      | `GET /challenges/daily` (server decides, so it is the same for every user)                                                                                                                                                                                       |
| ☐   | `artworks.saveArtwork` / `submitArtwork`                                                                                                      | Free Draw save, practice submit             | `POST /artworks` (multipart: PNG + metadata) → `Artwork`                                                                                                                                                                                                         |
| ☐   | `artworks.listArtworks` / `getArtwork`                                                                                                        | `/collection`, result page, profile         | `GET /artworks`, `GET /artworks/:id`                                                                                                                                                                                                                             |
| ☐   | `artworks.updateArtwork` / `deleteArtwork`                                                                                                    | Collection, lightbox                        | `PATCH /artworks/:id`, `DELETE /artworks/:id`                                                                                                                                                                                                                    |
| ☐   | `artworks.getImageUrl` / `getImageBlob` (+ `imageStore.*`)                                                                                    | Every artwork thumbnail                     | Signed CDN URLs returned with each `Artwork`. `imageStore` stays only for **local drafts**                                                                                                                                                                       |
| ☐   | `scoring.scoreArtwork`                                                                                                                        | Scoring ceremony → `/practice/result/:id`   | `POST /artworks/:id/score` → `ScoreResult` (vision model). Today it calls the local `analyse()` + `buildScore()`. The server can reuse the same sub-score names so the radar chart and tips still render. Consider a job/poll or SSE endpoint if scoring is slow |
| ☐   | `progress.recordActivity`                                                                                                                     | After submit, lesson, quiz, chat, free draw | Server-side event: `POST /progress/events` → `RewardSummary` (XP, level-up, new badges). **Gamification must be authoritative on the server**. Port `features/gamification/rules.ts`, which is pure and tested                                                   |
| ☐   | `progress.getChallenges` / `claimChallenge`                                                                                                   | Achievements, home                          | `GET /challenges`, `POST /challenges/:id/claim`                                                                                                                                                                                                                  |
| ☐   | `progress.getAchievements`                                                                                                                    | `/achievements`, profile                    | `GET /me/achievements` (XP, level, streak, badges, history)                                                                                                                                                                                                      |
| ☐   | `progress.getLeaderboard`                                                                                                                     | Achievements → leaderboard                  | `GET /leaderboard?scope=weekly\|all`                                                                                                                                                                                                      |
| ☐   | `learn.getLessons` / `getLesson` / `getMovements` / `getMovement` / `getArtists` / `getArtist` / `getArtForms` / `getArtForm` / `getGlossary` | All `/learn/*` pages                        | CMS endpoints (or keep them static. The content is already bilingual in `src/mocks`)                                                                                                                                                                             |
| ☐   | `learn.saveLessonProgress` / `completeLesson`                                                                                                 | Lesson page                                 | `PUT /me/lessons/:slug`                                                                                                                                                                                                                                          |
| ☐   | `learn.submitQuiz`                                                                                                                            | Lesson quiz                                 | `POST /lessons/:slug/quiz` → `QuizResult` (grade on the server)                                                                                                                                                                                                  |
| ☐   | `chat.streamChatReply`                                                                                                                        | `/chat`, Free Draw Muse drawer              | `POST /chat` with SSE or fetch streaming. Map chunks to `ChatStreamEvent` (`token`, `card`, `done`). Pass the `AbortSignal` through. `detectIntent` / `buildReply` can then be deleted                                                                           |
| ☐   | `chat.titleFor`                                                                                                                               | Chat sidebar                                | Server-generated conversation title (optional)                                                                                                                                                                                                                   |
| ☐   | `account.exportData` / `deleteAllData`                                                                                                        | Profile → Data                              | `GET /me/export`, `DELETE /me` (GDPR)                                                                                                                                                                                                                            |
| ☐   | `demo.seedDemoData` / `clearDemoData`                                                                                                         | Profile, empty Collection                   | Dev-only. Hide behind `import.meta.env.DEV` or remove                                                                                                                                                                                                            |

The **local-only** parts that stay in the browser are the drawing engine, studio autosave drafts (IndexedDB), theme, language, sound, reduced motion and the onboarding flags.

---

## Accessibility notes

- Keyboard: every control is reachable, with visible focus rings. The studio has single-key shortcuts (press `?` for the list), and modals and sheets trap focus and close with Esc.
- A skip link, landmark regions and `aria-live` announcements for scores, toasts and chat streaming.
- Colour contrast meets WCAG AA in both themes. Charts have tables and don't rely on colour alone.
- Reduced motion turns off washes, tilt, confetti, page wipes and count-ups.
- Touch: pinch to zoom and two-finger pan on the canvas, 44 px targets, and a mobile tab bar with a bottom-sheet tool panel in the studio.
