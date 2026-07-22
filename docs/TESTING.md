# Specter AI — Testing Guide

Testing follows the **testing pyramid** for Electron + AI apps: many fast unit tests, mocked integration tests, and a small set of live smoke probes.

References: [Electron testing guide](https://emadibrahim.com/electron-guide/testing), [three-stage AI agent verification](https://www.vibebrowser.app/blog/vibe-engineering-testing-an-agentic-ai-browser-auto-pilot), Vitest + layered E2E best practices (2025–2026).

---

## Pyramid (Specter-specific)

```
                    ┌─────────────────────┐
                    │  Live smoke probes  │  Gemini, capture, vision (macOS + .env)
                    │  pnpm test:*:live   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │  Mock integration (e2e.test)   │  OCR → router → playbook → rubric
              │  coach-pipeline, smart-capture │
              └────────────────┬───────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │  Unit tests (*.test.ts)                     │  Pure functions, no Electron, no API
        │  context-router, perception, usefulness...  │
        └─────────────────────────────────────────────┘
```

### Layer 1 — Unit (default `pnpm test`)

- **Pure business logic** — context router, fingerprint, playbook filter, code-error skill, usefulness rubric
- **No real API calls** — deterministic, runs in CI in seconds
- **No Electron** — main-process code tested by mocking `electron` / `store` where needed

### Layer 2 — Mock integration (`*.e2e.test.ts`)

- **Pipeline tests** without launching Electron: capture plan → perception merge → coach prompt → playbook injection → rubric scoring
- **Mock LLM stage** — scripted replies scored by `scoreCoachReply` instead of calling Gemini
- **IPC boundaries** — test handlers via extracted pure functions, not full `BrowserWindow`

### Layer 3 — Live smoke (`*.live.e2e.test.ts`, `scripts/test-*.mjs`)

| Script | Validates |
|--------|-----------|
| `pnpm test:coach:live` | Real Gemini + tactical usefulness rubric |
| `pnpm test:gemini:live` | API key + completion smoke |
| `pnpm test:screen:live` | macOS screencapture + OCR on dual monitor |
| `pnpm test:vision:live` | Multimodal screenshot + Gemini vision |
| `pnpm test:full:live` | All of the above |

Live tests require `GEMINI_API_KEY` in `.env` and macOS Screen Recording permission for capture probes.

---

## Perception truth hierarchy

For screen assistants, **structured signals beat raw OCR alone**:

1. **Accessibility** (app name, window title, AX text) — primary when rich
2. **OCR** — fallback and game-log structured parsing
3. **Vision** — when merged text is thin (`auto`) or forced (`vision`)

Tests in `perception.test.ts` and `coach-pipeline.e2e.test.ts` enforce this merge order.

---

## Commands

```bash
pnpm test              # unit + mock e2e (fast, no API)
pnpm test:unit         # same as pnpm test
pnpm test:watch        # vitest watch mode

pnpm test:coach:live   # live Gemini coach rubric
pnpm test:gemini:live
pnpm test:screen:live
pnpm test:vision:live
pnpm test:full:live    # everything

pnpm typecheck && pnpm build   # before manual QA
pnpm dev                       # run app after main-process changes
```

---

## What we deliberately skip (for now)

- **Playwright full Electron E2E** — reserved for critical UI flows (overlay open, settings persist). Business logic is extracted to testable services first.
- **100% coverage** — focus on code that changes often: router, perception, coach pipeline, store validation.

---

## Adding tests

1. **New skill or router rule** → unit test in `src/services/**/*.test.ts`
2. **New pipeline step** → extend `coach-pipeline.e2e.test.ts`
3. **New external dependency (API, OS capture)** → small live script under `scripts/` + entry in `test:full:live`

Keep live tests **small and flaky-resistant** — use rubrics (`scoreCoachReply`) not exact string matching for LLM output.
