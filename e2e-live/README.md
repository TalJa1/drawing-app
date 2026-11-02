# Live end-to-end specs

Real Chromium, real back-end. Not part of `npm run test:e2e` (that one is `playwright.config.ts`, `./e2e`).

| Spec                                   | What it needs                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lo1` `lo2` `lo3` `lo4b` `lo4c` `lang` | The back-end, **freshly seeded**, reachable at `/api/v1` of the page (the Vite proxy does that). The specs register their own accounts, so the back-end's per-IP sign-up and sign-in limits must be high for a run. |
| `pop`                                  | A back-end seeded so that four given templates were practised by 4, 3, 2 and 1 different people (see the header of the spec).                                                                                       |
| `errorboundary` `splash`               | Only the front-end (they do not call the API).                                                                                                                                                                      |

```bash
# 1. back-end on 127.0.0.1:8000 (the default target of the Vite proxy; VITE_PROXY_TARGET changes it)
# 2. front-end
npx vite --port 5199 --strictPort
# 3. specs
npx playwright test -c pw.live.config.ts                 # all
npx playwright test -c pw.live.config.ts e2e-live/lang.spec.ts
```

Environment variables: `E2E_BASE` (page address, default `http://localhost:5199`), `E2E_API` (absolute origin of the back-end if
the page does not proxy it; give the origin only, **without** `/api/v1`), `E2E_PROD=1` (the page is a production build: effects run once),
`PW_CHROMIUM` (path of a Chromium to use).

The back-end database must be new for each full run: the specs create accounts and drawings and some assertions count them.
The throw-away server used to run these in the project's checks is not part of this repository.
