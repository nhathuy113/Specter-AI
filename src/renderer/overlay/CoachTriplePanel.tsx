import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { sanitizeCoachDisplayText } from '../../shared/coach-display'

export interface CoachTriplePanelProps {
  labels: string[]
  panels: string[]
  panelDone: boolean[]
  placeholders?: readonly string[]
  isStreaming?: boolean
}

const COLUMN_ACCENTS = ['violet', 'sky', 'emerald'] as const

function CoachTriplePanel({
  labels,
  panels,
  panelDone,
  placeholders,
  isStreaming = false
}: CoachTriplePanelProps) {
  const columns = useMemo(
    () =>
      labels.map((label, index) => ({
        label,
        content: sanitizeCoachDisplayText(panels[index] || ''),
        done: panelDone[index],
        placeholder: placeholders?.[index],
        accent: COLUMN_ACCENTS[index] ?? 'violet'
      })),
    [labels, panels, panelDone, placeholders]
  )

  return (
    <div className="specter-coach-triple animate-fade-in">
      {columns.map((col, index) => (
        <div
          key={`${col.label}-${index}`}
          className={`specter-coach-triple-col specter-coach-triple-col--${col.accent}`}
        >
          <div className="specter-coach-triple-col-header">
            <div className="specter-coach-triple-col-title">
              <span className="specter-coach-triple-col-index">{index + 1}</span>
              <span>{col.label}</span>
            </div>
            {!col.done && isStreaming && (
              <span className="specter-coach-triple-spinner" aria-hidden />
            )}
          </div>
          <div className="specter-coach-triple-col-body">
            {col.content ? (
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{col.content}</ReactMarkdown>
            ) : isStreaming && !col.done ? (
              <span className="text-white/30 text-xs">Đang gọi model…</span>
            ) : (
              <span className="specter-coach-triple-placeholder">
                {col.placeholder || 'Chờ coach capture màn hình…'}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default memo(CoachTriplePanel)
