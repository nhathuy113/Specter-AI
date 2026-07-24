import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Download, Trash2, RefreshCw, Activity as ActivityIcon } from 'lucide-react'
import type { ActivityJournalEntry } from '../../../shared/types'
import {
  dayLabel,
  heatmapCellIntensity,
  summarizeHeatmap
} from '../../../services/activity-journal-heatmap'

function ActivityHeatmap({ entries }: { entries: ActivityJournalEntry[] }) {
  const summary = useMemo(() => summarizeHeatmap(entries), [entries])
  const hours = [0, 6, 12, 18, 23]

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-white/60">Focus heatmap (hour × day)</p>
        <p className="text-xs text-violet-300/80">{summary.peakLabel}</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-0.5 items-center">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-[9px] text-white/20 text-center">
                {hours.includes(h) ? h : ''}
              </div>
            ))}

            {Array.from({ length: 7 }, (_, day) => (
              <Fragment key={day}>
                <div className="text-[10px] text-white/30 pr-1 text-right">
                  {dayLabel(day)}
                </div>
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = summary.cells.find((c) => c.dayOfWeek === day && c.hour === hour)
                  const intensity = heatmapCellIntensity(cell?.totalSec ?? 0, summary.maxSec)
                  const mins = Math.round((cell?.totalSec ?? 0) / 60)
                  return (
                    <div
                      key={`${day}-${hour}`}
                      title={`${dayLabel(day)} ${hour}:00 — ${mins} min · ${cell?.entryCount ?? 0} switches`}
                      className="aspect-square rounded-sm border border-white/5"
                      style={{
                        backgroundColor: intensity
                          ? `rgba(139, 92, 246, ${0.12 + intensity * 0.75})`
                          : 'rgba(255,255,255,0.02)'
                      }}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-white/25">
        Darker = more focus time. Peak hours use top 60% of activity — switch apps often during peaks to log finer detail (~15s poll).
      </p>
    </div>
  )
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityJournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.specterAPI.listActivityJournal()
      setEntries([...data].reverse())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleExport = async () => {
    const md = await window.specterAPI.exportActivityJournal()
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `specter-activity-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    if (!confirm('Clear all activity journal entries?')) return
    window.specterAPI.clearActivityJournal()
    setEntries([])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-violet-400" />
            Activity Journal
          </h2>
          <p className="text-sm text-white/40 mt-1">
            Focus log for performance review — idle deduped, peaks when you switch apps/windows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => void handleExport()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs hover:bg-violet-500/30"
          >
            <Download className="w-3.5 h-3.5" />
            Export MD
          </button>
          <button
            onClick={handleClear}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-red-400/70 hover:text-red-400"
            title="Clear journal"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-white/30 text-sm">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-xl">
          <Clock className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No activity logged yet</p>
          <p className="text-white/15 text-xs mt-1">Turn on Watch + Activity Journal in Settings</p>
        </div>
      ) : (
        <>
          <ActivityHeatmap entries={entries} />

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-violet-300/80">{entry.minuteKey}</span>
                  <span className="text-[10px] text-white/25 uppercase">{entry.screenKind}</span>
                </div>
                <p className="text-sm text-white/70 mt-1">
                  {entry.appName}
                  {entry.windowTitle ? ` — ${entry.windowTitle}` : ''}
                </p>
                {entry.snippet && (
                  <p className="text-xs text-white/30 mt-1 line-clamp-2 font-mono">{entry.snippet}</p>
                )}
                <p className="text-[10px] text-white/15 mt-1">
                  ~{Math.max(1, Math.round(entry.durationSec / 60))} min focused
                  {entry.ocrChars ? ` · ${entry.ocrChars} OCR chars` : ''}
                  {entry.capturePlan ? ` · ${entry.capturePlan}` : ''}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
