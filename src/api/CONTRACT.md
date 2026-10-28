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

## AI chat — protocol v1, `src/api/ai/`

The paths below include the backend's `/api/v1` prefix. `VITE_API_BASE` is the origin plus
`/api`, for example `http://127.0.0.1:8000/api`. `VITE_CHAT_TRANSPORT=mock|server` selects
the transport; the default is mock in development and server in production.

| Method & path                 | Request                            | Response                                      |
| ----------------------------- | ---------------------------------- | --------------------------------------------- |
| `GET /api/v1/ai/health`       | Optional `Authorization: Bearer …` | `{ configured: boolean, protocolVersion: 1 }` |
| `POST /api/v1/ai/chat/stream` | JSON below                         | `text/event-stream`                           |

Both routes resolve identity. A valid JWT identifies the user. Guests (including mock
tokens) are accepted only when `AI_REQUIRE_AUTH=false` and the client IP is loopback.
Send `Content-Type: application/json` and `X-Request-ID: <requestId>`; compressed bodies
are unsupported. History stays on the client; AI uses no conversation database.

```json
{
  "protocolVersion": 1,
  "requestId": "r_1",
  "conversationId": "c_1",
  "turnId": "t_1",
  "action": "send",
  "mode": "colour",
  "lang": "vi",
  "message": { "text": "Suggest a coastal palette", "images": [] },
  "history": [
    { "role": "user", "text": "I have ten minutes" },
    { "role": "assistant", "text": "Try a small study.", "cards": [], "status": "completed" }
  ],
  "learner": { "level": 1, "completedLessons": [] }
}
```

`action` is `send|regenerate`; `mode` is `ideas|colour|composition|history`; `lang` is
`en|vi` (the message language takes precedence). `learner` may be `null` (level 1).
History roles are `user|assistant`. Assistant status is `completed|stopped|interrupted`.
A user history item may carry `images` or `imageMissing: true`; the latter asks the model
to acknowledge the missing image. `imageMissing` is not a field of the current message.

An image is `{ id, name, mime: "image/jpeg", dataUrl: "data:image/jpeg;base64,…", width,
height, hash }`. `width`/`height` are positive integers matching the JPEG. The browser
flattens transparency onto white before JPEG conversion; the server verifies the bytes.
Only the current turn's images, or the selected most recent image turn, are sent. New
images replace that context; clearing the active-image chip excludes it. If trimming
removes its source user item, the selected images move into the current message. A
missing current image stops the request with client error `image_missing`; a missing
history image uses `imageMissing` when its source item is retained.

| Limit                         | Value                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Current message text          | 4,000 characters                                                                 |
| History                       | 24 items, 60,000 text characters                                                 |
| Images                        | At most 3 across the request, belonging to one user turn                         |
| Each image                    | JPEG ≤ 1,100,000 bytes, data URL ≤ 1,500,000 characters, longest edge ≤ 1,600 px |
| Entire request body           | 6,000,000 bytes                                                                  |
| Cards                         | At most 6 emitted per turn                                                       |
| Image identifiers             | `id` and `hash`: 1–80 characters; `name`: 1–120                                  |
| Request/conversation/turn IDs | `[A-Za-z0-9._-]{1,64}`                                                           |

Count only `history[].text` toward 60,000 characters; cards and images do not count.
Before sending, FE drops the oldest whole user/assistant turns until both history limits
hold. BE applies the same request limits and may further trim model context in blocks
of six oldest turns when history exceeds about 16k estimated tokens. Stopped/interrupted
answers keep their text and are marked unfinished in model context. Validated card data
is included in assistant history; invalid old cards are dropped without rejecting the request.

SSE uses separate `event: <type>` and `data: <JSON>` lines followed by a blank line.
Ignore comment lines starting with `:` (keepalive). The JSON `type` matches the event.

```text
status  {"type":"status","phase":"thinking"}
token   {"type":"token","text":"Try this palette."}
card    {"type":"card","card":{"type":"palette","name":"Coast","colors":["#123456","#abcdef","#778899"]}}
done    {"type":"done","finish":"completed"}
done    {"type":"done","finish":"incomplete","reason":"max_output_tokens"}
error   {"type":"error","code":"rate_limited","retryAfterMs":5000}
```

The two `done` examples are alternatives. Exactly one `done` terminates the whole tool
loop; `error` terminates without `done`. Incomplete reasons include `max_output_tokens`,
`content_filter`, `max_messages`, `steered`, and `budget`; unknown reasons use generic
client copy. EOF without a terminal event and `done: incomplete` become `interrupted`.
Abort becomes `stopped`; errors become `failed`. Every path preserves received text.
Cards supplement a written answer and an immediate action. Requests for steps receive
written steps; requests for both a lesson and a template receive both cards. The server
allows at most three model rounds; a valid card-only round without text gets a
`tool_choice: "none"` text round when another round remains. The final round disables
tools. Every model image has an `Image id: <id>` label for critique references.

Before SSE, errors use `{ "error": { "code", "message", "traceId", "details"? } }`.

| HTTP / location | Codes                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| 401             | `unauthorized` (required token missing/invalid)                                 |
| 503             | `ai_not_configured` (no key), `service_unavailable` (JWT configuration missing) |
| 429             | `rate_limited`, `ai_busy`, `ai_budget_exceeded`; `Retry-After` in seconds       |
| 413             | `payload_too_large`                                                             |
| 415             | `unsupported_media_type` (non-JSON, compressed body, non-JPEG image)            |
| 400             | `bad_request` (malformed JSON)                                                  |
| 422             | `validation_error` (schema, oversize/corrupt image, decompression bomb)         |
| SSE `error`     | `upstream`, `timeout`, `model_unavailable`, `rate_limited`, `ai_not_configured` |
| Client only     | `network`, `protocol`, `client`, `image_missing`                                |

`retryAfterMs` is optional on SSE errors; FE converts an HTTP `Retry-After` to milliseconds.
`network` means fetch failed; `protocol` means invalid SSE/response; `client` is an unexpected
local failure; `image_missing` means a selected image cannot be loaded. Client-only codes
are never server SSE error codes. One active turn is allowed across the FE; BE permits
one stream per identity and three globally, 20 turns per 600 seconds per identity, and
an in-memory daily USD budget. The entire turn deadline is 120 seconds with a 45-second
upstream idle timeout. Stop, conversation changes and leaving the page abort the request.

All cards have a `type` discriminator. No model-provided HTML, SVG or route is accepted.

| Type       | Fields and rules                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `palette`  | `name` 1–40; 3–6 distinct `colors` matching `^#[0-9a-f]{6}$` case-insensitively; optional `roles` (`dominant`, `support`, `accent`) matches colors in length; optional `note` ≤ 160 |
| `idea`     | `title` 1–60; `description` 1–220; `difficulty` is `beginner`, `intermediate`, `advanced` or `master`; integer `minutes` 5–120                                                      |
| `critique` | `imageId` belongs to this request; `observations` 1–3; `strengths` ≤ 2; `priorities` ≤ 2; each item and required `exercise` 1–240 characters                                        |
| `lesson`   | Real catalog `slug`; optional `reason` ≤ 160                                                                                                                                        |
| `template` | Real catalog `templateId`, unlocked at `learner.level` (or level 1); optional `reason` ≤ 160                                                                                        |

Duplicate cards are emitted once. Invalid or locked tool cards are rejected so the model
can choose another. FE builds lesson/template routes from the validated slug/ID and its
own catalog; locked historical/mock templates show a lock without a link. Palette actions
copy HEX or send the palette to Studio; ideas open Free Draw; critiques select their own
image context for a follow-up. These actions do not award XP or complete lessons.

## Account & dev — `src/api/account.ts`, `src/api/demo.ts`

| Function                             | Method & path                           | Response                                                                |
| ------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------- |
| `exportData()`                       | `GET /me/export`                        | JSON file (user, settings, artworks, progress, learning, conversations) |
| `deleteAllData()`                    | `DELETE /me`                            | `204`                                                                   |
| `seedDemoData()` / `clearDemoData()` | dev only (`POST/DELETE /dev/demo-data`) | `204`                                                                   |
