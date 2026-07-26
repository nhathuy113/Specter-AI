import {
  ArrowRight,
  Code2,
  HelpCircle,
  Keyboard,
  Maximize2,
  Minimize2,
  Sparkles
} from 'lucide-react'

const FIRST_REPLY_STEPS = [
  'Trạng thái',
  'Vấn đề',
  'Giải thích',
  'Giải pháp',
  'Đọc code',
  'Tại sao'
] as const

const CONTINUATION_STEPS = [
  'Kẹt ở đâu',
  'Giải thích lại',
  'Snippet thay thế',
  'Tại sao'
] as const

const USER_TIPS = [
  {
    icon: Code2,
    title: 'Approve snippet',
    body: 'Gõ đúng code coach gợi ý → sang bước tiếp theo.'
  },
  {
    icon: HelpCircle,
    title: 'Chưa hiểu',
    body: 'Gõ "chưa hiểu" → giảng lại cùng bước, snippet dễ hơn.'
  },
  {
    icon: Sparkles,
    title: 'Đã có code + lỗi',
    body: 'Coach sửa trên code bạn — không viết lại từ đầu.'
  }
] as const

function WorkflowSteps({
  label,
  badge,
  steps,
  variant
}: {
  label: string
  badge: string
  steps: readonly string[]
  variant: 'primary' | 'secondary'
}) {
  return (
    <div className={`specter-work-guide-flow specter-work-guide-flow--${variant}`}>
      <div className="specter-work-guide-flow-head">
        <span className="specter-work-guide-flow-label">{label}</span>
        <span className="specter-work-guide-flow-badge">{badge}</span>
      </div>
      <div className="specter-work-guide-steps">
        {steps.map((step, index) => (
          <div key={step} className="specter-work-guide-step">
            <span className="specter-work-guide-step-num">{index + 1}</span>
            <span className="specter-work-guide-step-text">{step}</span>
            {index < steps.length - 1 && (
              <ArrowRight className="specter-work-guide-step-arrow" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Work mode empty state — structured guide beside default workflow. */
export default function WorkCoachGuidePanel() {
  return (
    <div className="specter-work-guide">
      <div className="specter-work-guide-modes">
        <div className="specter-work-guide-mode">
          <div className="specter-work-guide-mode-icon specter-work-guide-mode-icon--muted">
            <Minimize2 className="w-3.5 h-3.5" />
          </div>
          <div className="specter-work-guide-mode-body">
            <div className="specter-work-guide-mode-title">
              Pill <span className="specter-work-guide-mode-tag">Auto ON</span>
            </div>
            <p>Chỉ ghi nhật ký work — OCR màn hình, không gọi AI.</p>
          </div>
        </div>
        <div className="specter-work-guide-mode specter-work-guide-mode--active">
          <div className="specter-work-guide-mode-icon">
            <Maximize2 className="w-3.5 h-3.5" />
          </div>
          <div className="specter-work-guide-mode-body">
            <div className="specter-work-guide-mode-title">
              Panel mở <span className="specter-work-guide-mode-tag specter-work-guide-mode-tag--live">2–3 cột</span>
            </div>
            <p>Bài code (LeetCode) → Lite · 3.6 · Cursor SDK. Quiz / bài học / toán → chỉ 2 cột Gemini.</p>
          </div>
        </div>
      </div>

      <div className="specter-work-guide-grid">
        <section className="specter-work-guide-card">
          <h4 className="specter-work-guide-card-title">Khung workflow mặc định</h4>
          <WorkflowSteps
            label="Lần đầu"
            badge="6 mục"
            steps={FIRST_REPLY_STEPS}
            variant="primary"
          />
          <WorkflowSteps
            label="Tiếp theo"
            badge="4 mục"
            steps={CONTINUATION_STEPS}
            variant="secondary"
          />
          <p className="specter-work-guide-note">
            Snippet nhỏ · comment tiếng Việt · chưa approve thì không nhảy bước.
          </p>
        </section>

        <section className="specter-work-guide-card specter-work-guide-card--tips">
          <h4 className="specter-work-guide-card-title">Làm sao để coach helpful</h4>
          <ul className="specter-work-guide-tips">
            {USER_TIPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="specter-work-guide-tip">
                <span className="specter-work-guide-tip-icon">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div>
                  <p className="specter-work-guide-tip-title">{title}</p>
                  <p className="specter-work-guide-tip-body">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="specter-work-guide-footer">
        <Keyboard className="w-3 h-3 shrink-0 opacity-50" />
        <span>
          <kbd className="specter-work-guide-kbd">⌘/</kbd> ×2 bật/tắt Auto
        </span>
        <span className="specter-work-guide-footer-sep">·</span>
        <span>Gõ câu hỏi ở ô chat bên dưới</span>
      </div>
    </div>
  )
}
