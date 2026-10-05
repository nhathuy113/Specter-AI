import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { DEFAULT_SETTINGS } from '../shared/constants'
import {
  buildHourlyReportSummary,
  formatHourlyReportJson,
  formatHourlyReportMarkdown
} from '../services/journal/activity-journal-hourly-report'
import { getJournalEntries } from '../services/journal/activity-journal'
import { getSetting } from '../services/settings/store'

let reportTimer: ReturnType<typeof setTimeout> | null = null
let lastReportEndMs = 0

function reportsDir(): string {
  return path.join(app.getPath('userData'), 'reports')
}

function hourBoundaryMs(date = new Date()): number {
  const d = new Date(date)
  d.setMinutes(0, 0, 0)
  return d.getTime()
}

function reportPaths(periodStartMs: number): { mdPath: string; jsonPath: string; hourLabel: string } {
  const day = new Date(periodStartMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dayDir = path.join(
    reportsDir(),
    `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
  )
  const hourLabel = `${pad(day.getHours())}00`
  return {
    mdPath: path.join(dayDir, `${hourLabel}.md`),
    jsonPath: path.join(dayDir, `${hourLabel}.json`),
    hourLabel
  }
}

export function writeHourlyReport(periodStartMs: number, periodEndMs: number): string {
  const { mdPath, jsonPath, hourLabel } = reportPaths(periodStartMs)
  if (fs.existsSync(mdPath)) {
    return mdPath
  }

  const entries = getJournalEntries()
  const summary = buildHourlyReportSummary(entries, periodStartMs, periodEndMs)
  const md = formatHourlyReportMarkdown(summary)
  const json = formatHourlyReportJson(summary)

  fs.mkdirSync(path.dirname(mdPath), { recursive: true })
  fs.writeFileSync(mdPath, md, 'utf-8')
  fs.writeFileSync(jsonPath, json, 'utf-8')

  const latestDir = reportsDir()
  fs.mkdirSync(latestDir, { recursive: true })
  fs.writeFileSync(path.join(latestDir, 'latest.md'), md, 'utf-8')
  fs.writeFileSync(path.join(latestDir, 'latest.json'), json, 'utf-8')

  const payload = {
    label: hourLabel,
    periodStart: new Date(periodStartMs).toISOString(),
    periodEnd: new Date(periodEndMs).toISOString(),
    totalFocusSec: summary.totalFocusSec,
    entryCount: summary.entryCount,
    hoi4Sec: summary.hoi4Sec,
    topApp: summary.apps[0]?.appName ?? null,
    mdPath
  }
  console.info('AGENT_LOOP_WAKE_hourly_report ' + JSON.stringify(payload))

  return mdPath
}

function hourlyReportTick(): void {
  const endMs = hourBoundaryMs(new Date())
  const startMs = endMs - 3600_000

  if (endMs <= lastReportEndMs) return

  writeHourlyReport(startMs, endMs)
  lastReportEndMs = endMs
  scheduleNextHourlyReport()
}

function scheduleNextHourlyReport(): void {
  if (reportTimer) {
    clearTimeout(reportTimer)
    reportTimer = null
  }

  const intervalSec =
    getSetting<number>('hourlyReportIntervalSec') || DEFAULT_SETTINGS.hourlyReportIntervalSec
  const now = Date.now()
  const nextBoundary = hourBoundaryMs(new Date(now)) + intervalSec * 1000
  const delay = Math.max(1000, nextBoundary - now)

  reportTimer = setTimeout(() => {
    hourlyReportTick()
  }, delay)
}

export function stopHourlyReportLoop(): void {
  if (reportTimer) {
    clearTimeout(reportTimer)
    reportTimer = null
  }
}

export function syncHourlyReportLoop(): void {
  const journalEnabled =
    getSetting<boolean>('activityJournal') || getSetting<boolean>('fullAutoMode')
  const enabled = getSetting<boolean>('hourlyReportEnabled') ?? journalEnabled

  stopHourlyReportLoop()

  if (!enabled) return

  const intervalSec =
    getSetting<number>('hourlyReportIntervalSec') || DEFAULT_SETTINGS.hourlyReportIntervalSec

  // Catch up previous complete hour if missing (e.g. after restart)
  const prevEnd = hourBoundaryMs(new Date())
  const prevStart = prevEnd - intervalSec * 1000
  const { mdPath } = reportPaths(prevStart)
  if (!fs.existsSync(mdPath)) {
    writeHourlyReport(prevStart, prevEnd)
    lastReportEndMs = prevEnd
  }

  scheduleNextHourlyReport()
  console.info(`[Specter] Hourly report enabled — every ${intervalSec}s, saved to ${reportsDir()}`)
}

export function writeHourlyReportForTest(startMs: number, endMs: number): string {
  return writeHourlyReport(startMs, endMs)
}
