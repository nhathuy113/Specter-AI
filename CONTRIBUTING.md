# Contributing to Specter AI

Thanks for contributing! See [docs/ROADMAP.md](docs/ROADMAP.md) for product direction.

## Product focus

**Core:** virtual screen assistant — capture → OCR → context router → Gemini/OpenRouter → overlay advice.

**Nice to have:** audio transcription / meeting Whisper (optional, not required for most flows).

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/Specter-AI.git
cd Specter-AI
pnpm install
cp .env.example .env   # optional: seed GEMINI_API_KEY
pnpm dev
```

## Development Workflow

### Branch naming

- `feat/description` — features
- `fix/description` — bug fixes
- `docs/description` — documentation

### Before opening a PR

```bash
pnpm typecheck
pnpm test
pnpm build
```

For screen/coach changes on macOS with `.env` configured:

```bash
pnpm test:coach:live
pnpm test:screen:live
```

## Project structure

```
src/
  main/           Electron main (capture, IPC, coach loop)
  renderer/       Overlay + dashboard UI
  services/       AI, context-router, fingerprint, store
  shared/         types, constants, IPC channels
docs/
  ROADMAP.md      Product plan
```

## Architecture notes

- **Main process:** screen capture, OCR worker, IPC, continuous coach timer
- **Renderer:** isolated overlay + dashboard (no `nodeIntegration`)
- **AI providers:** Gemini (default), OpenRouter, OpenAI, Codex — BYOK
- **Coach flow:** `resolveAssistantRequest()` → optional instant reply → stream Gemini

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, etc.

## License

MIT — contributions under the same license.
