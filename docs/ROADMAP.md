# Specter AI — Roadmap

Specter is a **virtual screen assistant**: overlay + OCR + Gemini (BYOK). The user clicks everything; Specter recommends next steps.

Audio/meeting transcription exists in the codebase but is **nice to have**, not core product focus.

---

## Shipped (fork `tool` branch)

| Area | Status |
|------|--------|
| Transparent overlay (screen-share invisible) | Done |
| Screen OCR (Tesseract worker) | Done |
| Smart crop dual monitor | Done |
| Gemini direct + `.env` bootstrap | Done |
| OpenRouter / OpenAI / Codex providers | Done |
| **Analyze Screen** (1-click coach) | Done |
| **Watch** (continuous coach + fingerprint dedup) | Done |
| AI preflight (fail fast if no key) | Done |
| Context router (general / work / game / custom modes) | Done |
| Game-log skill (structured combat log OCR) | Done |
| **Hybrid perception** (Accessibility + OCR + Gemini vision) | Done |
| Context quality (app/window metadata, code-error skill, mode playbooks) | Done |
| Live e2e tests (`pnpm test`, `test:coach:live`, `test:screen:live`, `test:vision:live`, `test:full:live`) | Done |

---

## Original upstream plan (`CLAUDE.md` Phase 1–6)

Meeting copilot clone: overlay → OCR → OpenRouter → release. **Most phases complete.**

Audio (Phase 4) and meeting-first UX remain optional.

---

## Current architecture

```
Trigger (Ask | Analyze | Watch)
    → Smart crop capture
    → Perception (Accessibility + OCR, optional vision)
    → Context router (mode + screen kind + skills)
    → Prompt builder
    → Gemini (text or multimodal) / OpenRouter
    → Overlay (advise only)
```

### Assistant modes

| Mode | Behavior |
|------|----------|
| **General** | Help with whatever is on screen (default) |
| **Work** | Prioritize code / debugging |
| **Game** | Prioritize gameplay; Watch skips IDE-only screens |
| **Custom** | User's screen assistant prompt only |

### Screen kinds (auto-detected)

`empty` · `ide` · `code` · `game-log` · `browser` · `general`

---

## Phase B — Hybrid perception ✅

- [x] macOS Accessibility text (front app/window + shallow AX walk)
- [x] Gemini vision when OCR/AX text is thin (`Auto`) or always (`Vision`)
- [x] Setting: Perception = Auto | OCR | Vision
- [x] `pnpm test:vision:live`

---

## Phase C — Context quality ✅

- [x] Active app + window title in prompt
- [x] Code-error skill (parse TS/runtime errors from OCR)
- [x] Playbooks scoped by assistant mode (filter + UI)

---

## v1 complete

General virtual screen assistant: overlay advise-only, hybrid perception, mode-aware routing, playbooks, live test suite.

---

## Phase D — Optional / nice to have

- [ ] **Audio / Whisper** — meeting transcript context (already partially implemented)
- [ ] Gemini Live API (voice + stream watch)
- [ ] Local models via Ollama
- [ ] Event-driven capture (Screenpipe-style)

---

## Testing

See [docs/TESTING.md](docs/TESTING.md) for the full testing pyramid.

```bash
pnpm test                    # unit + mock e2e (fast, no API)
pnpm test:coach:live         # Gemini + usefulness rubric
pnpm test:gemini:live        # Gemini smoke
pnpm test:screen:live        # live capture + OCR (macOS dual monitor)
pnpm test:vision:live        # Gemini multimodal screenshot test
pnpm test:full:live         # all unit + live probes
pnpm test:e2e:live           # alias for test:full:live
```

After code changes to main process:

```bash
pnpm build && pnpm dev
```
