<p align="center">
  <img src="https://img.shields.io/badge/Specter_AI-7C3AED?style=for-the-badge&logoColor=white" alt="Specter AI" height="40" />
</p>

<h1 align="center">Specter AI</h1>

<p align="center">
  <strong>The AI copilot no one else can see.</strong>
</p>

<p align="center">
  Open-source, privacy-first AI screen & meeting copilot.<br>
  Invisible overlay powered by <a href="https://openrouter.ai">OpenRouter</a>. Bring your own API key.
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#contributing">Contributing</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/umairinayat/Specter-AI?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/electron-33+-47848F?style=flat-square&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/typescript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/openrouter-500%2B_models-7C3AED?style=flat-square" alt="OpenRouter" />
</p>

---

## What is Specter AI?

Specter AI is a **virtual screen assistant** — an always-on-top overlay that reads your screen (OCR), sends structured context to Gemini or OpenRouter, and recommends what to do next. You perform every action yourself.

Originally a meeting copilot (Cluely alternative); this fork emphasizes **Analyze Screen**, **Watch mode**, and dual-monitor smart crop. Audio transcription is available but **optional**.

- Reads your screen via OCR on demand or on an interval (Watch mode)
- Sends context to Gemini (default), OpenRouter, OpenAI, or Codex (BYOK)
- Streams responses into a translucent overlay invisible to most screen share
- Runs locally except the AI API call

---

## Features

### Invisible Overlay
- Transparent, always-on-top window with glass morphism styling
- Invisible to screen share on macOS (`type: 'panel'` + screen-saver level) and Windows (`setContentProtection`)
- Draggable, collapsible to a small pill when not in use

### Screen Assistant (core)
- **Analyze Screen** — one click, no typing; context router picks the right prompt
- **Watch mode** — continuous detect + fingerprint dedup + cooldown
- **Assistant modes** — General, Work, Game, Custom (Settings)
- Smart crop for dual monitor (game on external display)
- **Hybrid perception:** macOS Accessibility + OCR; Gemini vision when text is thin (Auto) or always (Vision)
- OCR via Tesseract.js in a worker thread

### Live Audio Transcription *(nice to have)*
- Optional microphone → Whisper (Groq/OpenAI/custom)
- Rolling transcript can be included when user asks with audio enabled

### AI Integration
- **Gemini** (default) via Google AI Studio key, or **OpenRouter** (500+ models)
- Streaming responses with token count and cost display
- Configurable system prompt and screen assistant prompt
- Preflight check — clear error if API key missing

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full plan and [docs/TESTING.md](docs/TESTING.md) for the testing pyramid.

### Playbooks
- Upload context documents (meeting prep, job descriptions, notes)
- Scope playbooks to assistant modes (General / Work / Game / Custom)
- Active playbooks are automatically injected into every AI prompt
- Create, edit, toggle, and delete playbooks from the dashboard

### Dashboard
- Settings: API key, overlay opacity, hotkeys, system prompt
- Models: browse and select from default or fetched OpenRouter models
- Playbooks: manage your context documents
- History: browse and revisit past conversations

### Global Hotkeys
| Shortcut | Action |
|---|---|
| `Ctrl+Enter` / `Cmd+Enter` | Ask AI with current context |
| `Ctrl+Shift+Enter` / `Cmd+Shift+Enter` | Ask AI with screenshot |
| `Ctrl+\` / `Cmd+\` | Toggle overlay visibility |
| `Ctrl+Shift+Space` / `Cmd+Shift+Space` | Toggle audio recording |

---

## Installation

### Download Pre-Built Binaries

Download the latest release for your platform from the [Releases](https://github.com/umairinayat/Specter-AI/releases) page:

| Platform | Format |
|---|---|
| Windows | `.exe` (NSIS installer) or portable `.exe` |
| macOS | `.dmg` (Intel & Apple Silicon) |
| Linux | `.AppImage` or `.deb` |

### Build from Source

**Prerequisites:** Node.js 18+ and [pnpm](https://pnpm.io) 9+

```bash
# Clone this fork (or the upstream repo)
git clone https://github.com/nhathuy113/Specter-AI.git
cd Specter-AI
git checkout pnpm   # pnpm-first branch on this fork

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for your platform
pnpm run build:win     # Windows
pnpm run build:mac     # macOS
pnpm run build:linux   # Linux
```

---

## Quick Start

1. **Launch Specter AI** -- the overlay appears in the top-right corner of your screen
2. **Open Settings** (right-click the system tray icon > Settings, or use the dashboard)
3. **Configure AI** — Gemini: paste `GEMINI_API_KEY` in Settings or `.env`. Or use OpenRouter.
4. **Select assistant mode** — General (default), Work, Game, or Custom
5. **Use it:**
   - Click **Analyze Screen** in the overlay
   - Type a question and press Enter
   - Press `Ctrl+Enter` / `Cmd+Enter` to ask with screen context
   - Enable **Watch** in Settings for continuous recommendations
   - *(Optional)* `Ctrl+Shift+Space` for audio transcription

---

## Architecture

```
specter-ai/
  src/
    main/                     Electron main process
      index.ts                App entry, window management
      overlay-window.ts       Invisible overlay BrowserWindow
      dashboard-window.ts     Settings dashboard window
      screen-capture.ts       Screenshot + OCR dispatch
      ocr-worker.ts           Tesseract OCR in worker thread
      audio-capture.ts        Mic recording + Whisper transcription
      hotkey-manager.ts       Global keyboard shortcuts
      tray.ts                 System tray menu
      ipc-handlers.ts         IPC bridge (main <-> renderer)

    preload/
      index.ts                Context-isolated IPC bridge

    renderer/
      overlay/                Transparent overlay UI (React)
        App.tsx               Main overlay logic
        ResponseCard.tsx      AI response rendering (markdown)
        TranscriptBar.tsx     Live transcript display

      dashboard/              Settings dashboard UI (React)
        App.tsx               Dashboard shell with sidebar
        pages/
          Settings.tsx        API key, opacity, hotkeys
          Models.tsx          Model browser/selector
          Playbooks.tsx       Context document manager
          History.tsx         Conversation history

    services/
      openrouter.ts           OpenRouter API client (streaming)
      context-builder.ts      Prompt assembly (screen + audio + query)
      store.ts                Persistent settings (electron-store)

    shared/
      types.ts                TypeScript interfaces
      constants.ts            App constants and defaults
      ipc-channels.ts         IPC channel name registry
```

### Data Flow

```
Screen -> screenshot-desktop -> Tesseract.js (worker thread) -> OCR text -\
                                                                           |-> context-builder -> OpenRouter API -> streaming response -> overlay
Microphone -> MediaRecorder API -> Whisper (Groq/OpenAI/custom) -> transcript text --------------/
```

### Privacy Model

- **All processing is local** except the AI API call to OpenRouter
- OCR text and transcript are sent to OpenRouter only when the user triggers a query
- No telemetry, no analytics, no data collection
- API key is encrypted locally via Electron `safeStorage` (OS keychain on macOS, DPAPI on Windows, libsecret on Linux)
- Raw audio and screenshots are never sent anywhere -- only extracted text

---

## Recommended Models

| Model | Speed | Quality | Cost |
|---|---|---|---|
| `google/gemini-flash-1.5` | Very fast | Good | ~$0.075/$0.30 per 1M tokens |
| `anthropic/claude-3-haiku` | Fast | High | ~$0.80/$4 per 1M tokens |
| `deepseek/deepseek-chat` | Fast | High | ~$0.14/$0.28 per 1M tokens |
| `meta-llama/llama-3.1-8b-instruct:free` | Medium | Decent | Free |

Browse all 500+ models at [openrouter.ai/models](https://openrouter.ai/models).

---

## Platform Notes

### macOS
- Overlay is excluded from screen share via `setAlwaysOnTop(true, 'screen-saver')` + `type: 'panel'`
- Requires Screen Recording permission (System Settings > Privacy > Screen Recording)
- Requires Microphone permission for audio transcription
- Works on both Intel and Apple Silicon

### Windows
- Overlay uses `setContentProtection(true)` to hide from screen capture
- Note: this hides the overlay from **all** screen capture including your own screenshots
- No special permissions required

### Linux
- Screen capture exclusion is limited and depends on your compositor
- Wayland support varies; X11 works more reliably
- AppImage is recommended for widest compatibility

---

## Comparison with Cluely

| Feature | Cluely | Specter AI |
|---|---|---|
| Price | $20-49/month | **Free** |
| Source code | Closed | **Open source (MIT)** |
| AI backend | Proprietary | **OpenRouter (500+ models)** |
| Data privacy | Cloud-dependent | **Local-first** |
| Model choice | Fixed | **Any model on OpenRouter** |
| Customization | Limited | **Full system prompt control** |
| Playbooks | Paid feature | **Built-in, free** |
| Self-hosting | No | **Yes** |

---

## Development

```bash
# Start in development mode with hot reload
pnpm dev

# Type check + unit/e2e tests (fast — no live API)
pnpm typecheck
pnpm test

# Live tests (macOS + .env with GEMINI_API_KEY)
pnpm test:coach:live
pnpm test:screen:live
pnpm test:vision:live
pnpm test:full:live   # all unit + live probes

# Build renderer + main process
pnpm build

# Build distributable for current platform
pnpm run build:win     # or build:mac / build:linux

# Build unpacked directory (for testing)
pnpm run build:unpack
```

### Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

The app stores the API key in its Settings UI via `electron-store`. Optional `.env` seeds defaults on first launch:

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google AI Studio key |
| `GEMINI_MODEL` | e.g. `gemini-3.1-flash-lite` |
| `AI_PROVIDER` | `gemini` (default), `openrouter`, etc. |
| `ASSISTANT_MODE` | `general`, `work`, `game`, `custom` |
| `PERCEPTION_MODE` | `auto`, `ocr`, `vision` |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Quick overview:**
1. Fork the repo
2. Create a branch (`feat/my-feature`)
3. Make your changes
4. Run `pnpm typecheck && pnpm build` to verify
5. Open a Pull Request

---

## Known Limitations

- **Whisper transcription** supports Groq (fastest, recommended), OpenAI, and custom endpoints. Configure the provider and API key in Settings.
- **Windows screen protection** hides the overlay from all capture, including the user's own screenshots.
- **Linux screen share exclusion** is unreliable on Wayland compositors.

---

## License

[MIT](LICENSE) -- free for personal and commercial use.

---

<p align="center">
  Built with Electron, React, TypeScript, and a healthy disregard for subscription fees.
</p>
