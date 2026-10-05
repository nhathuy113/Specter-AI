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
- `src/architecture`: automated dependency and IPC contract gates.

## Service modules

- `ai`: OpenRouter, OpenAI, Gemini and Codex clients; provider readiness checks.
- `audio`: transcription configuration, format policy, transcript state and HTTP transport.
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

## SOLID boundaries

`src/main/ipc-handlers.ts` is a composition root. Registration is split into AI,
capture/audio, settings, data and app/window handlers under `src/main/ipc`.
Validation and rate limiting are independent policies. The auto-capture loop
receives capture, configuration, lifecycle and publication capabilities rather
than importing windows or the settings store.

AI clients implement the small completion contract in `services/ai/contracts.ts`.
`providers.ts` wires concrete clients into the gateway; the gateway owns the
single terminal outcome contract. Provider configuration and pricing are separate
from IPC. Each HTTP request owns its abort controller, so finishing one parallel
panel cannot remove another panel's cancellation handle.

Work Coach orchestration consumes completion, Cursor, persistence and panel ports.
Its pure core does not import Electron, SDKs or the settings store. The existing
runner functions adapt these ports for main-process callers. Quiz schedulers own
their timers and generation tokens; user activity or a newer question invalidates
older Lite/deep results. Per-target request ownership similarly prevents obsolete
AI queries from publishing or saving results.

Session identity, prompt formatting, session transitions and persistence wiring
have separate modules. `createWorkCoachSession` takes a repository and clock.
Session transitions retain prior hints only when the problem key matches. Existing
exports remain available through the session facade for compatibility.

Extend a concrete adapter or a policy in its owning module. Avoid forcing native
client APIs into domain interfaces, or creating interfaces for every pure helper.

Audio capture is a small main-process composition root. The transcription service
receives settings and a transport port; multipart requests and deadlines belong
to the HTTP adapter. Transcript buffers are instance-owned. Clearing a transcript
aborts pending chunks and invalidates late responses, including transports that
ignore cancellation. Audio is uploaded from memory without creating temporary files.

Settings repositories receive persistence and secret-codec capabilities. Schema,
migrations, native encryption and Electron store loading live in separate modules.
Loading failures preserve the original configuration as a uniquely named backup;
migration failures cannot trigger recovery. Conversation updates copy the stored
array before writing, so failed persistence does not mutate loaded history.

## Preventing regressions

Run `pnpm check` for type checking, the complete offline test suite and the Electron
build. `pnpm test:architecture` runs the architecture gates alone. The regression
workflow runs `pnpm check` for pushes and pull requests with the pinned pnpm version
and frozen lockfile.

Architecture tests enforce these rules:

- Shared modules cannot import application layers, and services cannot import
  main/preload/renderer code at runtime.
- Domain cores cannot reach Electron, provider SDKs or persistence adapters,
  including through an intermediate dependency.
- Renderer runtime dependencies cannot reach native APIs or provider clients.
- Service modules cannot introduce runtime dependency cycles.
- Every preload send/invoke must have exactly one main handler of the matching
  registration kind.

Behavior tests cover parallel cancellation, one terminal stream outcome, panel
failure isolation, disposed targets, stale quiz results, session isolation,
context isolation and auto-capture overlap/stop behavior. Live provider and native
capture probes remain separate from these deterministic checks.
