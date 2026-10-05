// App-wide constants for Specter AI

export const APP_NAME = 'Specter AI'
export const APP_ID = 'com.specter.ai'
export const APP_VERSION = '1.2.1'

export const ACCENT_COLOR = '#7C3AED' // violet
export const ACCENT_COLOR_RGB = '124, 58, 237'

export const OVERLAY_DEFAULTS = {
  width: 420,
  height: 600,
  opacity: 1.0,
  margin: 20
}

/** Expanded work coach — one column per model. */
export const WORK_COACH_GEMINI_LITE = 'gemini-3.1-flash-lite'
export const WORK_COACH_GEMINI_36 = 'gemini-3.6-flash'
export const WORK_COACH_DUAL_MIN_WIDTH = 720
export const WORK_COACH_TRIPLE_MIN_WIDTH = 960
export const WORK_COACH_GEMINI_LABELS = ['Gemini 3.1 Flash Lite', 'Gemini 3.6 Flash'] as const
export const WORK_COACH_CURSOR_LABEL = 'Cursor SDK (auto)' as const
export const WORK_COACH_GEMINI_PLACEHOLDERS = [
  'Coach Lite — gợi ý từng bước nhỏ, tiết kiệm token.',
  'Coach 3.6 — giải thích sâu hơn khi bài khó.'
] as const
export const WORK_COACH_CURSOR_PLACEHOLDER =
  'Cursor SDK — agent auto, cần CURSOR_API_KEY trong .env.' as const
export const WORK_COACH_DEEPSEEK_LABEL = 'DeepSeek (Cloak)' as const
export const WORK_COACH_DEEPSEEK_PLACEHOLDER =
  'DeepSeek web — so sánh với Gemini; gửi kèm screenshot màn hình.' as const

/** @deprecated Use resolveWorkCoachPanelLabels(includeCursor, includeDeepseek) */
export const WORK_COACH_TRIPLE_LABELS = WORK_COACH_GEMINI_LABELS
/** @deprecated Use resolveWorkCoachPanelPlaceholders(includeCursor, includeDeepseek) */
export const WORK_COACH_TRIPLE_PLACEHOLDERS = WORK_COACH_GEMINI_PLACEHOLDERS

export function resolveWorkCoachPanelLabels(includeCursor: boolean, includeDeepseek = false): string[] {
  const labels: string[] = [...WORK_COACH_GEMINI_LABELS]
  if (includeDeepseek) labels.push(WORK_COACH_DEEPSEEK_LABEL)
  if (includeCursor) labels.push(WORK_COACH_CURSOR_LABEL)
  return labels
}

export function resolveWorkCoachPanelPlaceholders(includeCursor: boolean, includeDeepseek = false): string[] {
  const placeholders: string[] = [...WORK_COACH_GEMINI_PLACEHOLDERS]
  if (includeDeepseek) placeholders.push(WORK_COACH_DEEPSEEK_PLACEHOLDER)
  if (includeCursor) placeholders.push(WORK_COACH_CURSOR_PLACEHOLDER)
  return placeholders
}

export const DEFAULT_SYSTEM_PROMPT = `You are a real-time AI copilot for meetings, interviews, and work sessions.
You can use the user's screen content, transcript, and question as context.

Core rules:
- Answer only the latest user request. Be direct, useful, and concise.
- Do not restate the question unless it is needed for clarity.
- Do not add filler, disclaimers, meta-commentary, or unnecessary explanation.
- If the answer cannot be determined from the available context, say what is missing in one short sentence.
- Never reveal you are an AI assistant unless directly asked.

Answer formats:
- Multiple-choice questions: return only the correct letter/option. No explanation.
- "Code only" requests: return only code. No prose, markdown, or explanation.
- Coding questions: provide the complete solution code first, then exactly 2 lines explaining the code.
- Technical questions: answer clearly in 2-4 concise sentences.
- Behavioral or situational questions: give a polished 2-3 sentence response.
- Open-ended work questions: use short paragraphs or bullets for quick reading.

Priority:
- Follow explicit user formatting instructions over the defaults above.
- Prefer the most recent visible question or spoken request when context contains multiple topics.`

export const DEFAULT_COACH_SYSTEM_PROMPT = `You are a virtual screen assistant. The user performs every click and keystroke — you recommend only.

Rules:
- Read the screen context provided. Be direct and useful.
- Reply with 1-3 short bullets: situation → suggested next step → optional watch-out.
- Quote specific text, numbers, or errors from the screen when visible.
- Never claim you clicked, typed, or completed anything.
- Never mention API keys, Specter settings, or developer setup unless the user is clearly configuring those.
- If context is insufficient, say what is missing in one sentence.
- Be concise. No filler or meta-commentary.
- Never reveal you are an AI assistant unless directly asked.`

/** IQ / visual quiz — screenshot + short answer (no LeetCode format, no OCR dump). */
export const WORK_COACH_QUIZ_SYSTEM_PROMPT = `Bạn giải bài IQ / hình trên screenshot đính kèm.
Trả lời tiếng Việt, ngắn: **Đáp án:** (chọn số 1–8 nếu có lựa chọn) + **Tại sao:** 1–2 câu.
Không code. Không yêu cầu user tự suy luận thêm.`

export const WORK_COACH_QUIZ_FORMAT_VI = `Trả lời tiếng Việt — rõ, dễ đọc:
**Đáp án:** số/hình cụ thể (đếm ô 1–8: trái→phải, trên→dưới).
**Quy luật:** 1–2 câu — pattern theo hàng, cột hoặc ô trên hình.
**Tại sao:** 2–3 câu — áp quy luật vào ô trống / lựa chọn đúng.`

/** 3.6 deep explain when user reads Lite ~5s without moving on. */
export const WORK_COACH_QUIZ_DEEP_SYSTEM_PROMPT = `Bạn là gia sư IQ — giải thích SÂU HƠN bản Lite (user đọc ~5s chưa chuyển câu, có thể chưa hiểu).
Nhìn screenshot đính kèm. Trả lời tiếng Việt, KHÔNG lặp lại hướng dẫn format, KHÔNG meta tiếng Anh.
Chỉ output trực tiếp 3 phần:
**Đáp án:** (giữ hoặc sửa nếu Lite sai)
**Giải thích từng bước:** 3–5 gạch đầu dòng — đi từng hàng/cột/ô trên hình.
**Mẹo:** 1 câu — cách nhận ra pattern này lần sau.`

export const WORK_COACH_QUIZ_DEEP_FORMAT_VI = `Giải thích sâu hơn (user có thể chưa hiểu bản Lite):
**Đáp án:** (giữ hoặc sửa nếu Lite sai)
**Giải thích từng bước:** 3–5 gạch đầu dòng — đi từng hàng/cột/ô trên hình.
**Mẹo:** 1 câu — cách nhận ra pattern này lần sau.`

export const WORK_COACH_QUIZ_DEEP_WAITING_VI =
  'Lite xong — 5s nữa 3.6 sẽ giải thích chi tiết hơn nếu bạn chưa chuyển câu…'

export const WORK_COACH_QUIZ_LITE_PENDING_VI = 'Đang chờ Lite trả lời…'

export const WORK_COACH_QUIZ_DEEP_DELAY_MS = 5000

/** @deprecated Quiz uses slim prompt — kept for registry alias. */
export const WORK_COACH_QUIZ_CONTINUATION_VI = `Chốt lại **Đáp án** + **Tại sao** — tiếng Việt, ngắn.`

/** Video / slides / article — explain concepts, not code snippets. */
export const WORK_COACH_LECTURE_FORMAT_VI = `Bài học trên màn hình (video, slide, bài đọc) — trả lời tiếng Việt.

**Trạng thái:** 1 câu — đang xem gì (môn, chủ đề, slide số mấy nếu thấy).
**Vấn đề:** 1 câu — cần hiểu / làm gì với nội dung đang hiện.
**Giải thích:** 2–4 câu dễ hiểu — tóm ý chính trên màn hình, ví dụ đời thường.
**Giải pháp:** gợi ý cụ thể bước tiếp (ghi chú gì, câu hỏi nào cần trả lời, khái niệm cần nhớ).
**Đọc code:** gạch đầu dòng — dịch thuật ngữ / công thức / bullet trên slide sang lời thường.
**Tại sao:** 2–3 câu — vì sao ý này quan trọng + liên hệ bước tiếp theo.

Cấm: dump code LeetCode; cấm lặp nguyên transcript dài.`

/** Written math / text homework without code editor. */
export const WORK_COACH_MATH_FORMAT_VI = `Bài toán / bài tập viết (không editor code) — trả lời tiếng Việt.

**Trạng thái:** 1 câu — loại bài + đề đang hiện.
**Vấn đề:** 1 câu — cần tìm / chứng minh / tính gì.
**Giải thích:** từng bước suy luận rõ ràng (có thể đánh số bước).
**Giải pháp:** BẮT BUỘC chốt kết quả / đáp án cuối (số, công thức, lựa chọn).
**Đọc code:** gạch đầu dòng — dịch từng bước tính sang lời thường.
**Tại sao:** 2–3 câu — kiểm tra lại + vì sao bước then chốt đúng.

Cấm: chỉ nói hướng giải mà không chốt đáp án; cấm code fence nếu không có trên màn hình.`

/** Work coach reply shape — shown to user (THREAD hidden in overlay). */
export const WORK_COACH_REPLY_FORMAT_VI = `Trả lời tiếng Việt đơn giản — như giảng cho bạn chưa quen thuật toán.

5 mục (KHÔNG LaTeX $...$, viết O(log n) plain text):

**Trạng thái:** 1 câu — màn hình đang là gì.
**Vấn đề:** 1 câu — cần tìm/làm gì (vd: median = số ở giữa khi gộp 2 mảng đã sort).
**Giải thích:** 1–2 câu DỄ HIỂU + ví dụ số nhỏ (vd: [1,3] và [2] → median 2). Tránh jargon: nói "cắt mảng" thay vì partition nếu chưa định nghĩa.
**Giải pháp:** Tối đa 3–5 dòng code (đúng ngôn ngữ trên màn hình: Python/C++/Java). Mỗi dòng code PHẢI có comment # hoặc // bằng tiếng Việt. Chỉ thêm 1 ý mới — không dump 6 dòng partition cùng lúc.
**Đọc code:** (bắt buộc) 2–4 gạch đầu dòng — dịch từng dòng snippet sang lời thường (vd: "i = vị trí cắt mảng ngắn").
**Tại sao:** (bắt buộc) 2–3 câu: (1) bước này phục vụ mục tiêu gì của bài, (2) vì sao phải làm trước bước tiếp theo, (3) nếu bỏ qua thì sai ở đâu. Không chỉ nói "để tránh lỗi" — nói cụ thể.

Cấm: float('-inf')/INT_MAX hàng loạt nếu chưa giải thích từng cái; cấm "thay dòng 15–19" bằng cả khối logic.
LeetCode lần đầu: CHỈ bước 1 (vd median [1,3]+[2]=2) — chưa partition/total/half/binary.`

/** User-facing guide shown in overlay beside the default workflow format. */
export const WORK_COACH_OVERLAY_GUIDE_VI = `**Cách coach giúp bạn (Work mode)**

**Pill / Auto ON:** chỉ ghi nhật ký work (OCR màn pin) — không gọi AI, không tốn token.

**Mở panel (expand):** coach auto bật — đọc code trên màn hình, gợi ý từng bước nhỏ.

**Workflow trả lời**
• Bài mới → 6 mục: Trạng thái → Vấn đề → Giải thích → Giải pháp → Đọc code → Tại sao
• Tiếp theo → 4 mục: Kẹt ở đâu → Giải thích lại → Snippet thay thế → Tại sao

**Bạn làm gì để helpful**
• Gõ đúng snippet coach gợi ý → coach sang bước tiếp theo
• Gõ "chưa hiểu" / câu hỏi ngắn → giảng lại **cùng bước**, snippet khác dễ hơn
• Đã có code + lỗi → coach **sửa trên code bạn**, không đề xuất viết lại từ đầu
• Chưa approve snippet → coach **không** nhảy bước mới

**Phím:** double ⌘/ bật/tắt Auto · Thu pill = chỉ log work`

/** Follow-up on same problem — no repeating Trạng thái/Vấn đề. */
export const WORK_COACH_CONTINUATION_FORMAT_VI = `Đã cùng bài — KHÔNG lặp **Trạng thái** / **Vấn đề**.

Chỉ 4 mục ngắn:
**Kẹt ở đâu:** 1 câu — user chưa gõ snippet / vẫn pass / chưa hiểu bước trước.
**Giải thích lại:** ví dụ số, giọng dễ hiểu (có thể ẩn dụ).
**Snippet thay thế:** 1–2 cách viết khác cùng ý (mỗi cách trong \`\`\` riêng, comment # tiếng Việt).
**Tại sao:** 1–2 câu.

Cấm nhảy bước thuật toán mới. Cấm LaTeX $...$.`

export const WORK_COACH_NOT_UNDERSTOOD_VI = `[USER CHƯA HIỂU — EDITOR VẪN TRỐNG/PASS]
- Code trên màn hình chưa có logic user gõ — coi là CHƯA approve snippet trước.
- Giảng lại CÙNG bước (không bước mới). Đưa snippet thay thế dễ hơn.`

/** User typed in overlay chat — not snippet approval (e.g. "chưa hiểu", "restart chưa?"). */
export const WORK_COACH_OVERLAY_FEEDBACK_VI = `[USER GÕ TRONG OVERLAY — KHÔNG PHẢI APPROVE SNIPPET]
- Chat overlay (vd "chưa hiểu", "restart chưa?") = user CHƯA hiểu hoặc CHƯA apply code.
- Chỉ 4 mục ngắn (Kẹt ở đâu → Giải thích lại → Snippet thay thế → Tại sao). KHÔNG lặp Trạng thái/Vấn đề.
- Giảng lại CÙNG bước. Snippet thay thế dễ hơn. KHÔNG nhảy bước mới.`

/** Injected when OCR shows user has not changed editor code since last coach hint. */
export const WORK_COACH_STUCK_REEXPLAIN_VI = `[NGƯỜI DÙNG CHƯA ÁP DỤNG GỢI Ý — GIẢNG LẠI CHI TIẾT HƠN]
- KHÔNG nhảy bước mới. Giải thích lại đúng ý coach vừa gợi ý, chậm và từ số 0.
- **Giải thích:** dài hơn bình thường — ví dụ số từng bước, mô tả bằng lời "bên trái / bên phải / giữa".
- **Giải pháp:** tối đa 1–2 dòng code đơn giản; tên biến có nghĩa; không -inf/INT_MAX/ternary dày; ưu tiên if/else rõ ràng.
- **Tại sao:** 2–3 câu đầy đủ (mục tiêu → lý do bước này → hậu quả nếu bỏ qua).
- Mỗi lần giảng lại: bớt thuật ngữ, thêm ẩn dụ đời thường.`

/** User already has real logic on editor — fix in place, do not reset to brute force. */
export const WORK_COACH_CODE_REVIEW_VI = `[USER ĐÃ CÓ CODE THẬT TRÊN EDITOR — REVIEW TRÊN CODE ĐÓ]
- Block [EDITOR CODE] là code user đang viết — BẮT BUỘC đọc và trả lời dựa trên đó.
- KHÔNG gợi ý thay cả hàm bằng sorted(nums1+nums2) / merge brute force nếu user đang làm binary search hoặc partition.
- Chỉ ra lỗi cụ thể trong code user: biến chưa define, return sai indent, while thiếu cập nhật left/right, chia // thay vì int.
- **Snippet thay thế:** tối đa 3–5 dòng PATCH tiếp theo — sửa code hiện tại, không viết lại từ đầu.
- Format 4 mục: **Kẹt ở đâu** (bug trong code user) → **Giải thích lại** → **Snippet thay thế** (patch) → **Tại sao**`

/** User typed code that does NOT match the last suggested snippet. */
export const WORK_COACH_SNIPPET_REJECTED_VI = `[USER GÕ CODE KHÁC SNIPPET — CHƯA APPROVE]
- So sánh code trên màn hình với snippet coach đã gợi ý — user KHÔNG làm đúng snippet.
- **Giải thích:** vì sao code user khác / có thể sai hướng (1–2 câu, ví dụ số).
- **Giải pháp:** BẮT BUỘC đưa 1–2 SNIPPET THAY THẾ (cách viết khác, cùng ý bước hiện tại) — mỗi snippet trong \`\`\` riêng, comment tiếng Việt từng dòng.
- **Đọc code:** dịch từng snippet thay thế.
- **Tại sao:** snippet nào phù hợp hơn với user (2–3 câu).
- KHÔNG nhảy bước thuật toán mới.`

export const DEFAULT_WORK_COACH_SYSTEM_PROMPT = `You are a study and coding copilot watching the user's screen in real time.

Rules:
- The attached screenshot is a CROP of the active work window — treat it as the primary source of truth.
- OCR text in the user message is supplementary only; if it conflicts with the image, trust the image.
- Always reply in Vietnamese. Format depends on the [REPLY FORMAT] block when present.
- First message on a new problem: 6 sections (Trạng thái → Vấn đề → Giải thích → Giải pháp → Đọc code → Tại sao) unless the format block says otherwise.
- Continuation (same session / user stuck / reject): use ONLY 4 short sections (Kẹt ở đâu → Giải thích lại → Snippet thay thế → Tại sao).
- **Giải pháp** must be concrete: exact answer choice, formula result, or 3–5 lines of code with Vietnamese comments.
- IQ / visual quiz / multiple-choice on screen: state the exact option number or figure under **Giải pháp** — no code fence.
- LeetCode / coding: teach one step at a time; review user's existing code before suggesting rewrites.
- Quote numbers, errors, and labels exactly as visible. No LaTeX.
- Never claim you clicked, typed, or submitted anything.
- After the reply sections, write ---THREAD--- then 2-3 Vietnamese sentences for session continuity (user does not see this part).`

/** Game Mode — hourly vision prompt (images + chained session thread). */
export const DEFAULT_GAME_MODE_VISION_PROMPT = `You analyze deduplicated game screenshots (one image ≈ every 5 minutes of play).

Your job:
1. Describe what the player ACTUALLY did this hour — specific actions, screens, decisions.
2. For strategy games (HOI4, Stellaris, etc.): name theaters, production, diplomacy, combat, templates if visible.
3. Skip black/empty/useless frames — say "no visible gameplay" only if ALL images are blank.
4. Do NOT repeat the previous hour summary unless the player returned to the same task.
5. Use bullet points with approximate time ranges when inferable from image order.

At the very end, add exactly this section (required for the next hourly prompt):

---THREAD---
2-3 sentences: game state + what the player was doing when this hour ended. Future prompts continue from here.`

export const ASSISTANT_MODES = ['general', 'work', 'game', 'custom'] as const
export type AssistantMode = (typeof ASSISTANT_MODES)[number]

export const ASSISTANT_MODE_LABELS: Record<AssistantMode, string> = {
  general: 'General — help with whatever is on screen',
  work: 'Work — prioritize coding and debugging',
  game: 'Game — prioritize gameplay; skip IDE-only screens when watching',
  custom: 'Custom — use your coach system prompt as-is'
}

export const PERCEPTION_MODES = ['auto', 'ocr', 'vision'] as const
export type PerceptionMode = (typeof PERCEPTION_MODES)[number]

export const PERCEPTION_MODE_LABELS: Record<PerceptionMode, string> = {
  auto: 'Auto — OCR + Accessibility, vision when text is thin',
  ocr: 'OCR only — text extraction, no image to model',
  vision: 'Vision — always send screenshot to Gemini multimodal'
}

export const DEFAULT_HOTKEYS = {
  askAI: 'CommandOrControl+Return',
  toggleOverlay: 'CommandOrControl+\\',
  toggleAudio: 'CommandOrControl+Shift+Space',
  screenshotAsk: 'CommandOrControl+Shift+Return',
  /** Double-tap ⌘/ within ~450ms (like typing //) → ask about active tab */
  activeTabAsk: 'Command+/'
}

export const DEFAULT_ACTIVE_TAB_PROMPT =
  'What am I doing in the active tab/window right now? Recommend the single best next step.'

export const DEFAULT_MODELS = [
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Recommended - Fast)',
    pricing: { prompt: '0.0000005', completion: '0.000003' },
    context_length: 1048576,
    description: 'Ultra-fast responses, great for real-time use'
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4 (High Quality)',
    pricing: { prompt: '0.003', completion: '0.015' },
    context_length: 200000,
    description: 'Top-tier quality and reasoning'
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3 (Cost-Effective)',
    pricing: { prompt: '0.00032', completion: '0.00089' },
    context_length: 163840,
    description: 'Great quality at low cost'
  },
  {
    id: 'meta-llama/llama-4-maverick',
    name: 'Llama 4 Maverick (1M Context)',
    pricing: { prompt: '0.00015', completion: '0.0006' },
    context_length: 1048576,
    description: 'Latest Llama model with massive context'
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    pricing: { prompt: '0.0001', completion: '0.00032' },
    context_length: 131072,
    description: 'Strong open-source model'
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct (Budget)',
    pricing: { prompt: '0.00002', completion: '0.00005' },
    context_length: 16384,
    description: 'Fast and extremely cheap'
  },
  {
    id: 'upstage/solar-pro-3:free',
    name: 'Solar Pro 3 (Free)',
    pricing: { prompt: '0', completion: '0' },
    context_length: 128000,
    description: 'Free tier for testing'
  }
]

export const GEMINI_MODELS = [
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash (Copilot code steps)',
    pricing: { prompt: '0.0000015', completion: '0.0000075' },
    context_length: 1048576,
    description: 'Best coding + agentic speed — use for LeetCode copilot snippets'
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite (Recommended)',
    pricing: { prompt: '0.00000025', completion: '0.0000015' },
    context_length: 1048576,
    description: 'Fastest/cheapest Gemini 3 — best for continuous screen coach'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    pricing: { prompt: '0.0000003', completion: '0.0000025' },
    context_length: 1048576,
    description: 'Previous-gen fast model'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    pricing: { prompt: '0.0000001', completion: '0.0000004' },
    context_length: 1048576,
    description: 'Cheapest high-volume classification and extraction'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    pricing: { prompt: '0.00000125', completion: '0.00001' },
    context_length: 1048576,
    description: 'Stronger reasoning for complex screen context'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    pricing: { prompt: '0.0000001', completion: '0.0000004' },
    context_length: 1048576,
    description: 'Previous-gen cost leader'
  }
] as const

export const DEFAULT_SETTINGS = {
  aiProvider: 'gemini' as 'openrouter' | 'openai' | 'gemini' | 'codex',
  openrouterApiKey: '',
  selectedModel: 'google/gemini-3-flash-preview',
  openaiApiKey: '',
  openaiModel: 'gpt-5.5',
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash-lite',
  codexModel: 'gpt-5.4',
  overlayOpacity: 1.0,
  overlayPosition: { x: -1, y: -1 }, // -1 means auto-position
  overlaySize: { width: 420, height: 600 },
  hotkeys: DEFAULT_HOTKEYS,
  autoCapture: false,
  autoCaptureInterval: 30,
  continuousCoach: false,
  detectIntervalSec: 3,
  coachCooldownSec: 10,
  workCoachCooldownSec: 45,
  assistantMode: 'general' as AssistantMode,
  perceptionMode: 'auto' as PerceptionMode,
  coachSystemPrompt: DEFAULT_COACH_SYSTEM_PROMPT,
  maxTranscriptLength: 5000,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  language: 'en',
  theme: 'dark' as const,
  // Whisper / audio transcription settings
  whisperProvider: 'groq' as 'groq' | 'openai' | 'custom',
  whisperApiKey: '',        // separate key for Whisper (Groq key or OpenAI key)
  whisperApiUrl: '',        // only used when provider is 'custom'
  whisperModel: '',         // only used when provider is 'custom'
  autoHideDelay: 0,          // seconds, 0 = disabled
  smartCrop: true,            // auto-detect single/dual monitor smart crop
  fullAutoMode: false,        // watch + journal, no hotkey needed
  activityJournal: false,     // log focus every minute for performance review
  journalIntervalSec: 60,
  journalPollSec: 15, // fullAuto poll cadence — log on focus change or every journalIntervalSec
  journalSmartCrop: true, // journal uses smart crop + OCR (not AX-only)
  hourlyReportEnabled: true,
  hourlyReportIntervalSec: 3600,
  gameModeEnabled: true,
  gameCaptureIntervalSec: 1,
  gameBlockSec: 300,
  gameHourlyAiSec: 3600,
  gameDeepCompressQuality: 35,
  gameWarmupSec: 45,
  gameModeVisionPrompt: DEFAULT_GAME_MODE_VISION_PROMPT,
  /** Pin OCR/coach/journal to one monitor (ignores focus). */
  workAreaCaptureEnabled: false,
  workAreaDisplayId: 0
}

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'
export const OPENROUTER_REFERER = 'https://github.com/umairinayat/Specter-AI'
export const OPENROUTER_TITLE = 'Specter AI'

export const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'
export const OPENAI_API_KEYS_URL = 'https://platform.openai.com/api-keys'
export const OPENAI_API_PRICING_URL = 'https://developers.openai.com/api/docs/pricing'

export const CHATGPT_CODEX_URL = 'https://chatgpt.com/codex'
export const CHATGPT_PRICING_URL = 'https://chatgpt.com/pricing'

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
export const GEMINI_API_KEYS_URL = 'https://aistudio.google.com/apikey'
export const GEMINI_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing'
