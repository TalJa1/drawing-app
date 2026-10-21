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

| Function                | Method & path                                    | Response                  |
| ----------------------- | ------------------------------------------------ | ------------------------- |
| `getTemplates()`        | `GET /templates`                                 | `Template[]`              |
| `getTemplate(id)`       | `GET /templates/:id`                             | `Template`                |
| `dailyTemplateId(date)` | `GET /challenges/daily-template?date=YYYY-MM-DD` | `{ "templateId": "fox" }` |

```json
// Template (svg may be replaced by imageUrl to a 1200×900 transparent PNG/SVG)
{
  "id": "fox",
  "title": { "en": "Sitting Fox", "vi": "Cáo ngồi" },
  "category": "animals",
  "difficulty": "beginner",
  "minutes": 10,
  "unlockLevel": 1,
  "svg": "<svg …/>",
  "imageUrl": null,
  "suggestedPalette": ["#E4572E", "#F6F1E7"],
  "popularity": 96,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "tags": ["fox"]
}
```

## Artworks — `src/api/artworks.ts`

| Function                                  | Method & path                                             | Request                                                                       | Response                   |
| ----------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| `saveArtwork(req)` / `submitArtwork(req)` | `POST /artworks` (or `PUT /artworks/:id` when `id` given) | `multipart/form-data`: `image` (PNG), `thumbnail` (JPEG), `meta` (JSON below) | `Artwork`                  |
| `listArtworks()`                          | `GET /artworks`                                           | –                                                                             | `Artwork[]` (newest first) |
| `getArtwork(id)`                          | `GET /artworks/:id`                                       | –                                                                             | `Artwork`                  |
| `updateArtwork(id, p)`                    | `PATCH /artworks/:id`                                     | `{ favourite?, title? }`                                                      | `Artwork`                  |
| `deleteArtwork(id)`                       | `DELETE /artworks/:id`                                    | –                                                                             | `204`                      |
| `getImageUrl(key)`                        | (signed URL from `Artwork.imageKey` / `thumbKey`)         | –                                                                             | URL string                 |

```json
// meta
{ "kind": "practice", "title": "Sitting Fox", "templateId": "fox", "width": 1200, "height": 900,
  "timeSpent": 840, "medium": "Digital · marker & watercolour", "analysis": { /* ArtworkAnalysis */ } }

// Artwork
{ "id": "art_x", "kind": "practice", "title": "Sitting Fox", "templateId": "fox",
  "createdAt": "…", "updatedAt": "…", "timeSpent": 840, "width": 1200, "height": 900,
  "imageKey": "https://cdn/…/art_x.png", "thumbKey": "https://cdn/…/art_x.jpg",
  "favourite": false, "medium": "…", "analysis": { … }, "score": { /* ScoreResult */ } }
```

`analysis` (`ArtworkAnalysis`) is computed client-side by `features/drawing/analysis.ts`
(coverage of template regions, spill outside the outlines, hue buckets, harmony, value range,
saturation, a 9×12 coverage grid). A real AI judge can ignore it and score the image directly,
but it is cheap to send and useful as model features or for the heatmap.

## AI scoring — `src/api/scoring.ts`

| Function                  | Method & path              | Response      |
| ------------------------- | -------------------------- | ------------- |
| `scoreArtwork(artworkId)` | `POST /artworks/:id/score` | `ScoreResult` |

```json
// ScoreResult — all numbers 0–100, rank ∈ starter | rising | steady | gallery | masterpiece
{ "artworkId": "art_x", "similarity": 88, "colour": 81, "overall": 85,
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

Expected latency 2–6 s; the UI shows a "scoring ceremony" while waiting. Rank thresholds:
<40 starter, 40–59 rising, 60–74 steady, 75–89 gallery, ≥90 masterpiece.

## Progress & gamification — `src/api/progress.ts`

| Function                        | Method & path                                               | Request         | Response                                           |
| ------------------------------- | ----------------------------------------------------------- | --------------- | -------------------------------------------------- |
| `recordActivity(event)`         | `POST /progress/events`                                     | `ProgressEvent` | `RewardSummary`                                    |
| `getChallenges()`               | `GET /challenges`                                           | –               | `ChallengeStatus[]`                                |
| `claimChallenge(id, periodKey)` | `POST /challenges/:id/claim`                                | `{ periodKey }` | `RewardSummary`                                    |
| `getAchievements()`             | `GET /achievements`                                         | –               | `{ badges: (Badge & { unlockedAt?: ISODate })[] }` |
| `getLeaderboard(scope, filter)` | `GET /leaderboard?scope=weekly\|all&filter=global\|friends` | –               | `LeaderboardEntry[]` (sorted)                      |

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

The server must run the **same pure rules** as `features/gamification/rules.ts`
(`applyEvent`, `xpForScore`, `levelFromXp`, `evaluateBadges`, `updateStreak`) — they are
deliberately side-effect free so they can be shared or ported. Day boundaries use the
user's local timezone (send `X-Timezone`).

## Learning content — `src/api/learn.ts`

| Function                               | Method & path                                      | Response                             |
| -------------------------------------- | -------------------------------------------------- | ------------------------------------ |
| `getLessons()` / `getLesson(slug)`     | `GET /lessons`, `GET /lessons/:slug`               | `Lesson[]` / `Lesson`                |
| `getMovements()` / `getMovement(slug)` | `GET /movements[/:slug]`                           | `ArtMovement[]` / `ArtMovement`      |
| `getArtists()` / `getArtist(slug)`     | `GET /artists[/:slug]`                             | `Artist[]` / `Artist`                |
| `getArtForms()` / `getArtForm(slug)`   | `GET /art-forms[/:slug]`                           | `ArtForm[]` / `ArtForm`              |
| `getGlossary()`                        | `GET /glossary`                                    | `GlossaryTerm[]`                     |
| `saveLessonProgress(slug, progress)`   | `PUT /lessons/:slug/progress` `{ progress: 0–1 }`  | `204`                                |
| `completeLesson(slug)`                 | `POST /lessons/:slug/complete`                     | `RewardSummary \| null`              |
| `submitQuiz(slug, answers)`            | `POST /lessons/:slug/quiz` `{ answers: number[] }` | `{ correct, total, passed, reward }` |

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
