# Code structure

The top-level source folders follow Electron's process boundaries:

- `src/main`: application startup, windows, IPC handlers, native capture and
  background loop orchestration. The OCR worker remains a separate build entry.
- `src/preload`: the context-isolated bridge exposed to renderer windows.
- `src/renderer`: React views for the overlay and dashboard.
- `src/shared`: types, IPC channels, constants and display helpers shared across
  process boundaries.
- `src/services`: application logic grouped by responsibility.
- `src/e2e`: cross-feature pipeline tests and live fixtures.

## Service modules

- `ai`: OpenRouter, OpenAI, Gemini and Codex clients; provider readiness checks.
- `capture`: accessibility, display selection, work-area planning, smart crop,
  perception and screen fingerprints.
- `coach`: generic coach prompts, trigger state, tick coordination, diagnostics
  and response scoring.
- `context`: screen classification, request routing, prompt assembly and
  playbook selection. Context parsers live in `context/skills`; reusable OCR
  test inputs live in `context/fixtures`.
- `game`: game frame filtering, image compression, capture storage and hourly
  analysis.
- `journal`: activity capture, journal entries, heatmaps and hourly reports.
- `settings`: persistent settings, validation and environment bootstrap.
- `ui`: overlay geometry and double-tap hotkey detection.
- `work`: work auto settings, coaching sessions, problem profiles, quizzes,
  code snippets, provider coordination and escalation.

## Placing code and tests

Extend the module that owns the behavior. A file used by several features still
belongs to the module that owns its responsibility; importing it directly makes
that dependency visible. Avoid adding a generic utilities folder or a barrel
that imports every service.

Use direct relative imports within and between service modules. The existing
`@shared/*` and `@services/*` aliases remain available where configured. A
renderer should access native capabilities through the preload IPC bridge.

Keep unit tests beside their implementation as `*.test.ts`. Module-level
pipeline tests remain colocated as `*.e2e.test.ts`; broader pipelines live in
`src/e2e`. Live tests use `*live.e2e.test.ts` and the separate live configuration.
Resolve fixture paths relative to the test file and update them when moving it.

Run `pnpm typecheck`, `pnpm test:all`, `pnpm test:gate` and `pnpm build` after
moving modules. `pnpm test:live` uses external APIs or native capture and is
separate from the offline suite.
