# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

This is **two independently-versioned Node projects** in one folder, not a workspace/monorepo tool setup — each has its own `package.json`, `node_modules`, and TypeScript config:

- `backend/` — Express 5 + TypeScript + MongoDB/Mongoose API (`neurometrics-backend`)
- `frontend/` — Angular 22 app (`neurometrics-frontend`)

The root `package.json` (`neurometrics-suite`) only exists to run both at once: `npm run start-all` (uses `concurrently`).

**Git**: the whole tree (root, `backend/`, `frontend/`) is tracked in a single repo at the root. There is no separate nested repo under `frontend/` despite what directory-tree docs elsewhere may suggest.

## Common commands

Run these from inside `backend/` or `frontend/` respectively — there is no root-level build/test/lint.

### Backend (`backend/`)
```
npm run dev          # tsx watch src/app.ts — dev server on :3000, hot-reloads, does NOT type-check
npm run build         # tsc — real type-check + emit to dist/
npm run seed          # tsx src/seed.ts — wipes and repopulates the DB with one demo patient/sessions and three test accounts (CLINICIAN, RESEARCHER, ADMIN), all password `password123`
npm test              # vitest run --coverage
npm run lint          # eslint . --ext .ts
npm run clean          # rm -rf dist
```
**`npm run dev` (tsx watch) never type-checks** — it only strips types. A change can run fine under `npm run dev` while `npm run build`/`npx tsc --noEmit` fails. Always run `npm run build` before considering backend work done.

Backend uses a **dual TypeScript package alias** because TypeScript 7 (`@typescript/native`) ships no programmatic compiler API, which `typescript-eslint` needs:
```json
"typescript": "npm:@typescript/typescript6@^6.0.2",   // used by typescript-eslint / tooling
"@typescript/native": "npm:typescript@^7.0.2"          // the real compiler; `tsc`/npm run build use this transparently
```
`npm run build` and `npx tsc --noEmit` are unaffected — `@typescript/native`'s own `bin` is still named `tsc`. Installing/updating ESLint-related deps needs `--legacy-peer-deps` because `typescript-eslint`'s peer range doesn't know about TS7 yet.

**Mongoose 9 gotcha**: `Model.find({ someField: value })` (single-argument filter object) has a broken/unreliable overload in this project's type setup for some filter shapes. The pattern used everywhere in this codebase instead is `Model.find().where('someField').equals(value)`. Prefer that pattern for new queries.

### Frontend (`frontend/`)
```
npm start            # ng serve --port 4200 --open
npm run build         # ng build --configuration production — real type-check incl. template type-checking
npm test              # ng test — runs via @angular/build:unit-test with the Vitest runner (not Karma/Jasmine)
npm run lint          # ng lint (@angular-eslint, includes template + accessibility rules)
```
Angular's own compiler (`ng build`) catches template-binding type errors that plain `tsc` won't — prefer `ng build` over bare `tsc --noEmit` when verifying frontend changes.

### CI
`.github/workflows/ci-quality-gate.yml` runs `backend`'s `npm test` and `frontend`'s `ng test --no-watch --no-progress` on push/PR to `main`/`dev`. It pins Node 24 — this project's current tooling (vitest 5's rolldown native binding, Angular CLI 22) hard-requires Node ≥22.12/≥24/≥26 and fails outright on Node 20, so don't lower that pin without checking `npm ci`'s `EBADENGINE` warnings first.

## Architecture

### Auth & authorization
JWT-based (30 min expiry). Tokens are issued by `auth.routes.ts` (`/auth/login`) and verified by `verifyJwt` in `backend/src/middleware/auth.middleware.ts`, imported by every route module that needs it. Three roles, enforced in `sessions.routes.ts`'s `authorizePatientAccess`:
- `CLINICIAN` — only their own patients (`Patient.clinicianId` must match the JWT's user id)
- `RESEARCHER` — read-only access to all patients, with de-identified patient codes in list/CSV responses
- `ADMIN` — unrestricted

`role` is never accepted from the client on register or on patient creation — it's always assigned server-side.

The frontend mirrors this (defense-in-depth / UX only — the backend checks above are the real enforcement): `authGuard` (`frontend/src/app/core/guards/auth.guard.ts`) accepts an optional `data: { deniedRoles: [...] }` on a route, applied to `test-stroop`/`test-gonogo`/`test-flanker` to deny `RESEARCHER` (redirects to `/dashboard`, not `/login`, since the user is authenticated, just not authorized for that route). `PatientDashboardComponent` also hides the "+ Nuovo Paziente" and "Avvia Test" actions for `RESEARCHER` via an `isReadOnlyRole` computed signal.

### Patient context is shared state, not a route param
The Angular dashboard and all three experiment components (Stroop/Go-No-Go/Flanker) share a single selected patient via `PatientContextService` (a signal-based service), not a route param. Only the dashboard's `ngOnInit` calls `loadPatients()`. Navigating straight to `/test-stroop` etc. by URL bypasses that and the experiment correctly shows a "no patient selected" guard instead of crashing — this is expected, not a bug, when testing a route in isolation. Exception: `RESEARCHER` never reaches that guard at all — `authGuard`'s `deniedRoles` check redirects to `/dashboard` first (see "Auth & authorization" above).

### Frontend has no zone.js — state driving templates must be Signals
This app runs zoneless (no `zone.js` polyfill, no explicit `provideZonelessChangeDetection()` either — Angular 22's default). Signal writes notify the change-detection scheduler; **plain field mutations do not**, even from an `@HostListener` or `setTimeout` callback — the view can silently go stale. All three experiment components' trial-state machines (`currentState`, `activeTrial`, etc.) are Signals for exactly this reason. If you add new component state that drives the template, it must be a Signal.

### Trial data shape differs by test type
`TrialData` (frontend, `neuro-stats.service.ts`) and `TrialValidationSchema` (backend, `session.validator.ts`) both branch on shape rather than using one fixed set of required fields:
- Stroop: `stimulus`, `stimulusColor`, `correctResponse`/`userResponse` ∈ `{'r','v'}`
- Flanker: `stimulus` (no `stimulusColor`), `correctResponse`/`userResponse` ∈ `{'ArrowLeft','ArrowRight'}`
- Go/No-Go: `stimulusType` ∈ `{'GO','NO_GO'}`, `actionTaken` ∈ `{'PRESS','NONE'}`, `reactionTimeMs` is `0` for an omitted (`NONE`) response — that's valid data, not missing data

`reactionTimeMs` is bounded server-side at `[0, 60000]` — no lower physiological floor at the schema level (a 50ms-per-shape check happens in `superRefine`), and 60000 is deliberately generous because Stroop/Flanker have no response timeout, so a slow-but-real trial must not fail validation.

### Statistics pipeline
`backend/src/modules/sessions/data-cleaner.ts`'s `NeuroDataCleaner.cleanByRobustMAD` does median/MAD-based outlier exclusion — **but only when the input array has ≥5 elements**; smaller subsets (common for a per-condition split of a 20-trial run) pass through completely unfiltered, physiological floor included. Don't assume outliers are always excluded from summary stats. `exgaussian.ts` implements ex-Gaussian moment estimation (μ, σ, τ) from scratch — see `exgaussian.spec.ts` for the reference test cases.

### Normative comparison (Z-scores)
`computeClinicalZScore` (`backend/src/utils/zscore.helper.ts`) looks up a `NormativeData` row (`backend/src/database/models/normative.schema.ts`) matching the patient's age/education band + `testType` + `metricName`, and returns `(patientValue - populationMean) / populationStdDev`, or `null` if no band matches (not an error — e.g. a patient outside every seeded band). It's computed once, server-side, in `POST /sessions` (`sessions.routes.ts`) and cached on `summaryStats.zScorePrimary`/`zScoreTau` — not recomputed on read. `seed.ts`'s normative rows are **explicitly placeholder values, not validated clinical norms** (see its own comment). All three metrics (`interferenceEffect`, `falseAlarmRate`, `tau`) are "higher = worse", so an impaired patient scores a **positive** Z — the severity thresholds in both the PDF report and the dashboard badge check `zScore >= 1.5/2.0`, not `<=`. Getting this backwards is a real, previously-shipped bug (inverted severity direction), not a hypothetical.

### API base URL
Frontend services (`AuthService`, `NeuroStatsService`) call the backend directly at a hardcoded `http://localhost:3000/api...`, not through the dev-server proxy. `proxy.conf.json` (`/api` → `localhost:3000`) exists and is used only by `DataService`'s demo `/api/test` call. Don't assume all HTTP calls go through the proxy.

## Domain constraints (clinical/research context)

This is a neuropsychological assessment tool (Stroop, Go/No-Go, Flanker reaction-time tasks) handling patient data:
- Never present computed output as a medical diagnosis or make clinical claims beyond what's actually measured.
- Preserve raw trial data distinct from cleaned/derived values — never silently discard observations or alter units when touching the statistics pipeline.
- Treat reaction-time and timeout behavior as correctness-critical: consider browser event timing, invalid/missed/duplicate input, and aborted sessions.
- Keep authentication, authorization, validation, and patient/session ownership checks explicit at API boundaries — don't rely on the frontend to enforce them.
- Never put secrets, tokens, or real patient data in logs, exports, tests, or generated code.
