# Art Spark — API contract (v0, derived from the mock layer)

Every screen talks to the "server" only through the typed functions in `src/api/*`.
Today they are mocks (latency via `simulate()`, data in Zustand + IndexedDB). This
document is the spec for the real back-end: implement these endpoints, then replace
each function body with a `fetch()` call. Signatures and the TypeScript types in
`src/types/index.ts` are the source of truth for JSON shapes.

Conventions

- Base URL: `VITE_API_BASE` (default `/api`). JSON in/out, `Authorization: Bearer <token>`.
- Timestamps are ISO-8601 strings (`ISODate`), local calendar days are `YYYY-MM-DD` (`DayKey`).
- Bilingual content uses `Localized = { "en": string, "vi": string }`.
- Errors: HTTP status + `{ "error": { "code": string, "message": string } }`.
  The client maps them to `ApiError(message, status, code)`. Codes used by the UI:
  `not_found`, `invalid_credentials`, `already_claimed`, `incomplete`, `missing_analysis`, `simulated_failure`.

---

## Auth — `src/api/auth.ts`

| Function           | Method & path         | Request                               | Response                             |
| ------------------ | --------------------- | ------------------------------------- | ------------------------------------ |
| `login(req)`       | `POST /auth/login`    | `{ email, password }`                 | `AuthResponse { user: User, token }` |
| `register(req)`    | `POST /auth/register` | `{ email, password, displayName }`    | `AuthResponse`                       |
| `logout()`         | `POST /auth/logout`   | –                                     | `204`                                |
| `updateProfile(p)` | `PATCH /me`           | `{ displayName?, bio?, avatarSeed? }` | `User`                               |
| `getMe()`          | `GET /me`             | –                                     | `User` (a guest has none: no call)   |

`getMe()` runs once when the app is opened while signed in (`App.tsx`), so a profile changed on another device shows up
here. If the server cannot be reached the profile already on screen stays; a `401` signs the person out (client).

```json
// User
{
  "id": "u_123",
  "email": "lan@example.com",
  "displayName": "Lan",
  "bio": "",
  "avatarSeed": "lan",
  "createdAt": "2026-10-21T08:00:00.000Z",
  "isGuest": false
}
```

Guests can use everything; on first login the server should merge the guest's local
gallery/progress (the client can upload `GET /me/export` output).

## Templates — `src/api/templates.ts`

| Function                  | Method & path                                                                                | Response                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `getTemplates()`          | `GET /templates`                                                                             | `Template[]`                                                               |
| `getTemplate(id)`         | `GET /templates/:id`                                                                         | `Template`                                                                 |
| (`<img src>`)             | `GET /templates/:id/image` (= `imageUrl`)                                                    | `image/png` 1200×900                                                       |
| `getDailyTemplateId()`    | `GET /challenges/daily-template` (optional `?date=YYYY-MM-DD`; the server uses `X-Timezone`) | `{ "templateId": "fox" }`                                                  |
| `getTemplatePopularity()` | `GET /template-popularity` (public)                                                          | `{ "windowDays": 30, "asOf": ISODate, "counts": { "fox": 12, "cat": 0 } }` |

```json
// Template. `svg` is always sent (the studio colours and draws on it). `imageUrl` is a
// server-relative path to the template's 1200×900 PNG (opaque white background, not transparent);
// the field is absent until the server has the file. The storage key is never exposed.
{
  "id": "fox",
  "title": { "en": "Sitting Fox", "vi": "Cáo ngồi" },
  "category": "animals",
  "difficulty": "beginner",
  "minutes": 10,
  "unlockLevel": 1,
  "svg": "<svg …/>",
  "imageUrl": "/api/v1/templates/fox/image",
  "suggestedPalette": ["#E4572E", "#F6F1E7"],
  "popularity": 96,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "tags": ["fox"]
}
```

`counts` has every template the server lists; the value is the number of different people who saved a
practice drawing of it in the last `windowDays` days (0 when nobody did). The library's "Most popular"
order is this number, highest first; the server keeps it for minutes, so it can lag a little.

## Artworks — `src/api/artworks.ts`

Artworks belong to an account: a guest has none (the app sends them to sign in). Nothing is kept on the
device any more.

| Function                                  | Method & path                         | Request                                                                       | Response                                           |
| ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| `saveArtwork(req)`                        | `POST /artworks`                      | `multipart/form-data`: `image` (PNG), `thumbnail` (JPEG), `meta` (JSON below) | `{ artwork, reward? }` (see below)                 |
| `submitArtwork(req)`                      | `POST /artworks` (`kind=practice`)    | same                                                                          | `Artwork`                                          |
| `listArtworks()`                          | `GET /artworks?limit=500&cursor=`     | –                                                                             | `Artwork[]` (newest first; every page is followed) |
| `getArtwork(id)`                          | `GET /artworks/:id`                   | –                                                                             | `Artwork`                                          |
| `updateArtwork(id, p)`                    | `PATCH /artworks/:id`                 | `{ favourite?, title? }` (nothing else can change)                            | `Artwork`                                          |
| `deleteArtwork(id)`                       | `DELETE /artworks/:id`                | –                                                                             | `204`                                              |
| `acquireImage(key)` / `getImageBlob(key)` | `GET /artworks/:id/image` or `/thumb` | – (needs the bearer token)                                                    | `{ url, release }` lease / `Blob`                  |

```json
// meta
{ "kind": "practice", "title": "Sitting Fox", "templateId": "fox", "width": 1200, "height": 900,
  "timeSpent": 840, "medium": "Digital · marker & watercolour", "analysis": { /* ArtworkAnalysis */ } }

// Artwork
{ "id": "3f1c2a64-…", "kind": "practice", "title": "Sitting Fox", "templateId": "fox",
  "createdAt": "…", "updatedAt": "…", "timeSpent": 840, "width": 1200, "height": 900,
  "imageKey": "/api/v1/artworks/3f1c2a64-…/image", "thumbKey": "/api/v1/artworks/3f1c2a64-…/thumb",
  "favourite": false, "medium": "…", "analysis": { … }, "score": { /* ScoreResult */ } }
```

- **`reward`** — the answer to `POST /artworks` also carries `reward` (a `RewardSummary`) when, and only
  when, that request created a **free** drawing: it pays at once. A practice drawing pays when it is
  scored, and the same PNG sent again (`200` instead of `201`) pays nothing, so `reward` is absent then.
  `saveArtwork` hands it back apart from the artwork and refreshes the XP shown (`GET /me/progress`).
- **Pictures** — `imageKey` / `thumbKey` are API paths, and the server gives a picture only to its owner,
  so an `<img src>` cannot load it. `acquireImage` fetches the bytes with the token and hands back a lease
  `{ url, release }`: `url` is an object URL that stays valid until `release()` is called (once is enough,
  further calls do nothing). Each picture is fetched once and kept in a cache that is emptied when the user
  signs out. Only `/api/v1/artworks/<uuid>/image|thumb` keys are ever fetched with the token.
- **Picture memory** — the cache has a soft ceiling, `IMAGE_CACHE_LIMIT_BYTES` (64 MiB, a chosen figure and
  not a measurement; a thumbnail was about 0.4 MB and a full picture about 1.5 MB when looked at once).
  Over the ceiling the least recently used pictures are dropped (and their object URLs revoked), but never
  one that is on screen (leased and not yet released) or still loading, so the ceiling can be exceeded while
  that many pictures are shown. A dropped picture is simply fetched again when asked for. `getImageBlob`
  does not pin anything. `ArtworkImage` with `lazy` (the Collection grid) only asks for a picture when its
  card is within 400px of the screen and releases it again beyond 1600px; without `IntersectionObserver`
  it loads at once.
- **Errors** — `template_locked` (403), `not_found` (404), `rate_limited` (429, 60 uploads a day),
  `payload_too_large` (413), `unsupported_media_type` (415). The app shows its own sentence per code
  (`errors.api.*`), not the server's English text.

`analysis` (`ArtworkAnalysis`) is computed client-side by `features/drawing/analysis.ts`
(coverage of template regions, spill outside the outlines, hue buckets, harmony, value range,
saturation, a 9×12 coverage grid). The server stores it, checks it against the PNG, and scores from it.

## Scoring — `src/api/scoring.ts`

| Function                  | Method & path              | Response                                        |
| ------------------------- | -------------------------- | ----------------------------------------------- |
| `scoreArtwork(artworkId)` | `POST /artworks/:id/score` | `{ score: ScoreResult, reward: RewardSummary }` |

No body: the server judges the drawing it saved (from its `analysis`) and pays the XP, including the
template-of-the-day and personal-best bonuses. It then refreshes the XP shown (`GET /me/progress`).
Errors: `missing_analysis` / `not_scorable` (422), `not_found`, `rate_limited`, `scoring_not_configured` (501).

```json
// ScoreResult — all numbers 0–100, rank ∈ starter | rising | steady | gallery | masterpiece
{ "artworkId": "3f1c2a64-…", "similarity": 88, "colour": 81, "overall": 85,
  "sub": { "lineAccuracy": 90, "composition": 86, "proportion": 88,
           "harmony": 80, "suitability": 83, "aesthetics": 79 },
  "rank": "gallery",
  "strengths":  [{ "en": "…", "vi": "…" }],
  "weaknesses": [{ "en": "…", "vi": "…" }],
  "feedback":   [{ "en": "…", "vi": "…" }],
  "tips":       [{ "en": "…", "vi": "…" }, {…}, {…}],
  "judgeNote":   { "en": "…", "vi": "…" },
  "scoredAt": "2026-10-21T09:00:00.000Z" }
```

Rank thresholds: <40 starter, 40–59 rising, 60–74 steady, 75–89 gallery, ≥90 masterpiece.
The old local judge (`buildScore`) is kept only for the demo artworks; nothing that scores a user's drawing calls it.

## Progress & gamification — `src/api/progress.ts`

| Function                        | Method & path                        | Request         | Response                                           |
| ------------------------------- | ------------------------------------ | --------------- | -------------------------------------------------- |
| `recordActivity(event)`         | `POST /progress/events`              | `ProgressEvent` | `RewardSummary`                                    |
| `getChallenges()`               | `GET /challenges`                    | –               | `ChallengeStatus[]`                                |
| `claimChallenge(id, periodKey)` | `POST /challenges/:id/claim`         | `{ periodKey }` | `RewardSummary` (XP comes from the definition)     |
| `getAchievements()`             | `GET /achievements`                  | –               | `{ badges: (Badge & { unlockedAt?: ISODate })[] }` |
| `getLeaderboard(scope)`         | `GET /leaderboard?scope=weekly\|all` | –               | `LeaderboardEntry[]` (sorted, best first)          |

These four need an account (a guest gets `401`), so the **Achievements page is behind `RequireAuth`** (a guest is sent
to sign in and brought back) and the hooks do not ask while nobody is signed in. A list that is not a list is
treated as a failure (the page shows a retry), never as "nobody here". `ChallengeStatus` is
`{ challenge, periodKey, progress, claimed, theme? }`; claim with the `periodKey` the server named. Claim failures:
`404 not_found`, `409 already_claimed`, `422 incomplete` (the page has a sentence of its own for each).
After a claim the app refreshes the XP (`syncProgress()`) and the challenges, badges and rankings; a refused claim
refreshes the challenges only.

`LeaderboardEntry` is `{ id, name, avatarSeed, xp, weeklyXp, level, isCurrentUser? }`: **real people only** (no sample
users, no `country`), `id` is the rank as a string, `isCurrentUser` is present only when true. With few accounts the
list is short; one entry that is the person themselves is shown as "you are the only one so far".

`ProgressEvent` is a tagged union (`features/gamification/types.ts`), e.g.

```json
{ "type": "artworkScored", "score": { … }, "templateId": "fox", "category": "animals",
  "seconds": 840, "isDaily": true, "distinctHues": 5, "previousBest": 61 }
{ "type": "lessonCompleted", "slug": "rule-of-thirds", "xp": 40 }
{ "type": "viewed", "what": "movement", "slug": "cubism" }
```

```json
// RewardSummary
{
  "xpGained": 145,
  "xpBefore": 480,
  "xpAfter": 625,
  "levelBefore": 2,
  "levelAfter": 3,
  "newBadges": ["first-masterpiece"],
  "streak": 4,
  "streakExtended": true,
  "completedChallenges": ["d-high-score"]
}
```

**Which side decides what (while the screens are being connected one by one):**

- For a signed-in user the server decides the XP of `artworkSaved` (free drawings, in the answer to
  `POST /artworks`), `artworkScored` (in the answer to `POST /artworks/:id/score`) and `download`
  (`POST /progress/events`). The app never reports the first two (`recordActivity` refuses them with
  `event_not_allowed`), and after each of these it refreshes the numbers with **`syncProgress()`**
  (`GET /me/progress`), also done right after signing in. A failed `download` earns nothing and says nothing.
- What only the browser can witness is also reported to `POST /progress/events` for a signed-in user:
  `download`, `viewed`, `flashcardReviewed`, `spotStyle`, `colorLab`, `paletteSent`, `glossary`
  (sent exactly as shaped, never with an `xp`). A failure (offline, rate limit) earns nothing and says nothing.
- **Lessons and quizzes (lot 4c):** for a signed-in user the server decides `lessonCompleted` and `quizCompleted`
  (in the answers of `POST /lessons/:slug/complete` and `POST /lessons/:slug/quiz`); the app never reports them as events, and after a
  reward it refreshes with `syncProgress()`. So the challenges `d-lesson`, `w-lessons` and `w-quiz` now move for a signed-in user.
  A guest still runs the rules on the device (nothing is sent), and the quiz of a guest is graded from the local mock keys until lot 6.
- **`chatMessage` is never sent**: the AI chat is outside the backend, which refuses the event (`422 event_not_allowed`).
  The app still counts chat messages on the device, but for a signed-in user the challenge `w-chat` and the badge
  `muse-friend` **cannot be completed** until the owner decides how chat should count.
- `GET /me/progress` has no challenges (they have their own endpoint); the ones kept on the device are left untouched by the refresh
  and are no longer shown to anyone (the page reads `GET /challenges`).

The server runs the **same pure rules** as `features/gamification/rules.ts`
(`applyEvent`, `xpForScore`, `levelFromXp`, `evaluateBadges`, `updateStreak`) — they are
deliberately side-effect free so they can be shared or ported. Day boundaries use the
user's local timezone (send `X-Timezone`).

## Learning content — `src/api/learn.ts`

| Function                               | Method & path                                      | Response                                                               |
| -------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| `getLessons()` / `getLesson(slug)`     | `GET /lessons`, `GET /lessons/:slug`               | `Lesson[]` / `Lesson`                                                  |
| `getMovements()` / `getMovement(slug)` | `GET /movements[/:slug]`                           | `ArtMovement[]` / `ArtMovement`                                        |
| `getArtists()` / `getArtist(slug)`     | `GET /artists[/:slug]`                             | `Artist[]` / `Artist`                                                  |
| `getArtForms()` / `getArtForm(slug)`   | `GET /art-forms[/:slug]`                           | `ArtForm[]` / `ArtForm`                                                |
| `getGlossary()`                        | `GET /glossary`                                    | `GlossaryTerm[]`                                                       |
| `saveLessonProgress(slug, progress)`   | `PUT /lessons/:slug/progress` `{ progress: 0–1 }`  | `204` (the server keeps the largest)                                   |
| `completeLesson(slug)`                 | `POST /lessons/:slug/complete`                     | `RewardSummary \| null` (null: paid before)                            |
| `submitQuiz(slug, answers)`            | `POST /lessons/:slug/quiz` `{ answers: number[] }` | `{ correct, total, passed, reward \| null, review[] }`                 |
| `setBookmark(slug, on)`                | `PUT` / `DELETE /me/bookmarks/:slug`               | `204`                                                                  |
| `reviewCard(termId, knewIt)`           | `PUT /me/flashcards/:termId` `{ knewIt: boolean }` | `{ termId, box, due, serverTime }`                                     |
| `syncLearning()`                       | `GET /me/learning`                                 | `{ lessons, bookmarks, lastLesson, flashcards, spotBest, serverTime }` |

**Who keeps the learning state (lot 4c).** A **guest** keeps lessons, bookmarks and flashcards on the device (`useLearn`);
nothing is sent. A **signed-in** person's state is the server's:

- `syncLearning()` runs when the app opens signed in, when the flashcards page opens, and right after signing in; its answer
  **replaces** what the device had (`useLearn.replace`). A guest's local learning is therefore **not** merged into the account.
- `syncProgress()` (XP, streak, badges, activity) likewise runs when the app opens signed in, besides after sign-in and after every
  reward, so a reward earned on another device shows up without signing in again. Failing to reach the server leaves what the device shows.
- Whenever the token changes (sign-in, sign-up, sign-out, a different account) **both** `useLearn` and `useProgress` are emptied
  at once (a subscription in `api/learn.ts`), so nothing of one person is shown to the next.
- `completeLesson`, `submitQuiz` and `reviewCard` write to the device only after the server answered. If it does not, they throw
  (the lesson is not marked finished, so opening it again retries; the quiz keeps the answers for "Try again"; the card stays).
  `saveLessonProgress` shows the progress at once and never throws (the next scroll sends it again). `setBookmark` shows the
  bookmark at once and puts it back if the server says no (it throws, the page says so).
- **Flashcards:** the server owns the box and the due time (`knewIt` is all the app sends). Times are the server's clock:
  `due` is stored on the device as `Date.now() + (due − serverTime)`, so a wrong phone clock does not move a card.
  `PUT` is applied one card at a time and the page ignores a second press while one is being saved.
  The guest's rule stays in `FlashcardsPage.tsx` (the backend's parity test reads that file).
- Writes are limited to 120 per minute per user (`429 rate_limited`).

Artist works and movement examples carry an optional `imageUrl` — today they are rendered
as generative SVG placeholders; a CMS can supply licensed/public-domain images.

## AI chat — `src/api/chat.ts`

| Function                       | Method & path                            | Request                                        | Response                    |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------- | --------------------------- |
| `streamChatReply(req, signal)` | `POST /chat/stream` (Server-Sent Events) | `{ message, mode, lang, attachments?, seed? }` | stream of `ChatStreamEvent` |

```text
event: token   data: {"type":"token","text":" Hello"}
event: card    data: {"type":"card","card":{"type":"palette","name":"Teal harmony","colors":["#1F8A8A","#8A1F1F"]}}
event: done    data: {"type":"done"}
```

`mode` ∈ `ideas | colour | composition | history` (sets the system prompt / tone).
Cards: `palette { name, colors[] }`, `template { templateId }`, `idea { title, description, difficulty, minutes }`,
`lesson { slug }`. Attachments are `{ kind: "image", src: <data URL or uploaded URL>, artworkId?, name }`.
Conversations are stored client-side today; a `GET/POST /conversations` resource can be added later.

## Account & dev — `src/api/account.ts`, `src/api/demo.ts`

| Function                             | Method & path                           | Response                                                                |
| ------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------- |
| `exportData()`                       | `GET /me/export`                        | JSON file (user, settings, artworks, progress, learning, conversations) |
| `deleteAllData()`                    | `DELETE /me`                            | `204`                                                                   |
| `seedDemoData()` / `clearDemoData()` | dev only (`POST/DELETE /dev/demo-data`) | `204`                                                                   |
