import { readAiConnection } from '../../services/ai/ai-configuration'
import { buildAssistantMessages } from '../../services/context/assistant-messages'
import { createRequestOwnership } from '../../services/ui/request-ownership'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getSetting } from '../../services/settings/store'
import { getCachedModels } from '../../services/ai/openrouter'
import { buildUserMessage, estimateTokens } from '../../services/context/context-builder'
import { resolveCoachRequest, buildActiveTabUserMessage } from '../../services/coach/coach-prompt'
import { appendWorkCoachContext, evaluateWorkCoachCodeReview, getWorkCoachThread, loadWorkCoachSession, updateWorkCoachThread } from '../../services/work/work-coach-session'
import { resolveWorkCoachEscalation } from '../../services/work/work-coach-escalation'
import { runWorkCoachEscalation, runWorkCoachQuizVision } from '../../services/work/work-coach-runner'
import { markQuizUserActivity } from '../../services/work/work-coach-quiz-escalation'
import { workSessionKey } from '../../services/work/work-coach-session'
import { isUserConfusionFeedback } from '../../services/work/work-coach-snippet'
import { resolveWorkProblemProfile, shouldUseCursorWorkCoach } from '../../services/work/work-problem-profile'
import { resolveBackgroundCaptureParams } from '../../services/capture/background-capture-params'
import { extractScreenContext } from '../../services/context/context-router'
import { isCoachDebugEnabled, patchCoachDebugCompletion, writeCoachDebug } from '../../services/coach/coach-debug'
import { buildPlaybookContext, filterPlaybooksForMode } from '../../services/context/playbook-filter'
import { getRecentJournalContext } from '../../services/journal/activity-journal'
import { checkAiConfig } from '../../services/ai/ai-config'
import { captureScreenText } from '../screen-capture'
import { getTranscript } from '../audio-capture'
import { shouldRunCoachVerboseLogging } from '../overlay-window'
import { DEFAULT_SETTINGS } from '../../shared/constants'
import type { AssistantMode, PerceptionMode, ScreenMetadata } from '../../shared/types'
import type { Playbook } from '../../shared/types'
import { isValidQuery, isValidMessageHistory } from './input-validation'
import { completionGateway } from '../../services/ai/providers'
import { completionCost, completionModelLabel } from '../../services/ai/completion-pricing'
import { cloakDeepseekProfileReady, selectCompletionRoute } from '../../services/ai/completion-route'

export function registerAiIpcHandlers(checkRateLimit: (channel: string) => boolean): void {
  const requests = createRequestOwnership<object>()
  // AI Query — streaming with cost tracking
  ipcMain.on(IPC_CHANNELS.AI_QUERY, async (event, args: {
    query: string
    includeScreen: boolean
    includeAudio: boolean
    messageHistory?: Array<{ role: string; content: string }>
    screenTextOverride?: string
    screenshotOverride?: string
    useVisionOverride?: boolean
    screenMetadata?: ScreenMetadata
    coachMode?: boolean
    activeTabMode?: boolean
  }) => {
    // Rate limit
    if (!checkRateLimit(IPC_CHANNELS.AI_QUERY)) {
      event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, 'Too many requests. Please wait a moment.')
      return
    }

    // Validate inputs
    if (!isValidQuery(args?.query)) {
      event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, 'Invalid query.')
      return
    }

    if (args.query?.trim() && args.query.trim() !== '[Coach auto]') {
      markQuizUserActivity()
    }

    if (args.messageHistory && !isValidMessageHistory(args.messageHistory)) {
      event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, 'Invalid message history.')
      return
    }

    const assistantMode = (getSetting<string>('assistantMode') || DEFAULT_SETTINGS.assistantMode) as AssistantMode
    const effectiveCoachMode = args.coachMode || assistantMode === 'work'
    const aiConfig = checkAiConfig()
    const cloakCoach = !!effectiveCoachMode && cloakDeepseekProfileReady()
    if (!aiConfig.configured && !cloakCoach) {
      event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, aiConfig.error || 'AI is not configured. Open Settings to continue.')
      return
    }

    const ownsRequest = requests.begin(event.sender)
    const isCurrent = () => ownsRequest() && !event.sender.isDestroyed()
    const target = {
      isDestroyed: () => !isCurrent(),
      send: (channel: string, payload: unknown) => { if (isCurrent()) event.sender.send(channel, payload) }
    }

    const aiProvider = aiConfig.provider
    const { model, apiKey } = readAiConnection(aiProvider, getSetting)
    const geminiApiKey = getSetting<string>('geminiApiKey') || ''
    const route = selectCompletionRoute(!!effectiveCoachMode, aiProvider, cloakCoach)
    const systemPrompt = effectiveCoachMode
      ? getSetting<string>('coachSystemPrompt')
      : getSetting<string>('systemPrompt')

    let screenText = ''
    let screenScreenshot: string | undefined
    let useVision = false
    let screenMetadata: ScreenMetadata = args.screenMetadata ?? {}
    let workProblemProfile: ReturnType<typeof resolveWorkProblemProfile> | undefined
    let transcript = ''

    const applyWorkProblemVision = () => {
      if (assistantMode !== 'work' || !screenScreenshot) return
      useVision = true
    }

    if (typeof args.screenTextOverride === 'string' && args.screenTextOverride.trim()) {
      screenText = args.screenTextOverride.trim()
      screenScreenshot = args.screenshotOverride
      useVision = args.useVisionOverride ?? false
      if (assistantMode === 'work') {
        workProblemProfile = resolveWorkProblemProfile(
          screenText,
          screenMetadata,
          extractScreenContext(screenText, assistantMode, screenMetadata).kind
        )
        applyWorkProblemVision()
      }
    } else if (args.includeScreen) {
      try {
        const p = resolveBackgroundCaptureParams((key) => getSetting(key))
        let capture: Awaited<ReturnType<typeof captureScreenText>>
        try {
          capture = await captureScreenText(p.activeWindowOnly, p.perceptionMode, {
            skipAccessibility: p.skipAccessibility,
            coachVision: p.coachVision
          })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : ''
          if (!message.includes('already in progress')) throw err
          await new Promise((resolve) => setTimeout(resolve, 500))
          capture = await captureScreenText(p.activeWindowOnly, p.perceptionMode, {
            skipAccessibility: p.skipAccessibility,
            coachVision: p.coachVision
          })
        }
        screenText = capture.text
        screenScreenshot = capture.screenshot
        useVision = capture.useVision ?? false
        screenMetadata = {
          appName: capture.appName,
          windowTitle: capture.windowTitle,
          textSource: capture.textSource,
          displayCount: capture.displayCount
        }
        workProblemProfile = resolveWorkProblemProfile(
          screenText,
          screenMetadata,
          extractScreenContext(screenText, assistantMode, screenMetadata).kind
        )
        if (assistantMode === 'work') {
          applyWorkProblemVision()
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Screen capture failed'
        console.warn('[Specter] Screen capture failed:', message)
        if (isCurrent()) {
          event.sender.send(
            IPC_CHANNELS.AI_STREAM_ERROR,
            message.includes('already in progress')
              ? 'Screen capture is busy. Wait a second, then press Analyze Screen again.'
              : message
          )
        }
        return
      }
    }

    // Get audio transcript if requested
    if (args.includeAudio) {
      transcript = getTranscript()
    }

    if (!isCurrent()) return

    const userOverlayFeedback = isUserConfusionFeedback(args.query ?? '')

    const playbooks = getSetting<Playbook[]>('playbooks') || []
    const activePlaybooks = filterPlaybooksForMode(playbooks, assistantMode)
    const playbookContext = buildPlaybookContext(activePlaybooks)

    let coachInstantReply: string | undefined
    let coachUserMessage = effectiveCoachMode
      ? (() => {
          if (args.activeTabMode) {
            const coachReq = resolveCoachRequest(screenText, assistantMode, screenMetadata)
            coachInstantReply = coachReq.instantReply
            return coachInstantReply ?? buildActiveTabUserMessage(screenText, assistantMode, screenMetadata)
          }
          const coachReq = resolveCoachRequest(screenText, assistantMode, screenMetadata)
          coachInstantReply = coachReq.instantReply
          return coachReq.userMessage
        })()
      : buildUserMessage({
          screenText,
          transcript,
          userQuery: args.query
        })

    let workCoachCodeReview = evaluateWorkCoachCodeReview(screenText, screenMetadata)
    if (effectiveCoachMode && assistantMode === 'work' && userOverlayFeedback) {
      workCoachCodeReview = { status: 'unchanged', replyMode: 'stuck-reexplain' }
    }

    if (effectiveCoachMode && assistantMode === 'work' && !coachInstantReply) {
      const thread = getWorkCoachThread(screenText, screenMetadata)
      const session = loadWorkCoachSession()
      const stuckRetryCount = session?.stuckRetryCount ?? 0
      coachUserMessage = appendWorkCoachContext(coachUserMessage, thread, {
        replyMode: workCoachCodeReview.replyMode,
        codeReviewStatus: workCoachCodeReview.status,
        suggestedSnippet: session?.lastSuggestedSnippet,
        stepSummary: session?.lastCoachStepSummary,
        screenText,
        metadata: screenMetadata,
        profile: workProblemProfile,
        userOverlayQuery: userOverlayFeedback ? args.query : undefined,
        stuckRetryCount:
          workCoachCodeReview.replyMode === 'stuck-reexplain' ? stuckRetryCount + 1 : stuckRetryCount
      })
    }

    const workCoachEscalation =
      effectiveCoachMode && assistantMode === 'work' && !coachInstantReply
        ? resolveWorkCoachEscalation(
            workCoachCodeReview.replyMode,
            loadWorkCoachSession()?.stuckRetryCount ?? 0
          )
        : null

    const userMessage = coachUserMessage

    const journalEnabled = getSetting<boolean>('activityJournal') || getSetting<boolean>('fullAutoMode')
    // Coach = screen-only; journal/playbooks caused HOI4/mod noise on unrelated tabs (e.g. YouTube)
    const journalContext =
      effectiveCoachMode ? '' : journalEnabled ? getRecentJournalContext(30) : ''

    const messages = buildAssistantMessages({
      coachMode: !!effectiveCoachMode, assistantMode, systemPrompt,
      userMessage, playbookContext, journalContext, history: args.messageHistory,
      useVision, instantReply: coachInstantReply
    })
    const finalUserContent = messages[messages.length - 1].content

    const systemContent = messages[0]?.content ?? ''
    let coachDebugPath: string | null = null
    if (effectiveCoachMode && isCoachDebugEnabled() && shouldRunCoachVerboseLogging()) {
      coachDebugPath = writeCoachDebug({
        ts: new Date().toISOString(),
        query: args.query ?? '',
        assistantMode,
        effectiveCoachMode,
        screenMetadata,
        screenTextChars: screenText.length,
        screenText,
        workCoachCodeReview,
        workCoachEscalation,
        workProblemKind: workProblemProfile?.kind,
        useVision: useVision && !coachInstantReply,
        systemPrompt: systemContent,
        userPrompt: finalUserContent
      })
    }

    // Estimate prompt tokens for cost tracking
    const promptTokens = estimateTokens(messages.map(m => m.content).join(' '))
    let completionContent = ''

    const streamCallbacks = {
      onChunk: (content: string) => {
        completionContent += content
        if (isCurrent()) {
          event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, content)
        }
      },
      onDone: () => {
        if (!isCurrent()) return
        if (coachDebugPath && completionContent.trim()) {
          patchCoachDebugCompletion(coachDebugPath, completionContent)
        }
        if (effectiveCoachMode && assistantMode === 'work' && completionContent.trim()) {
          updateWorkCoachThread(screenText, screenMetadata, completionContent, {
            triggerReview: workCoachCodeReview.status
          })
        }
        if (isCurrent()) {
          const completionTokens = estimateTokens(completionContent)
          const totalTokens = promptTokens + completionTokens
          const modelLabel = route === 'deepseek-cloak' ? 'deepseek-cloak/web' : completionModelLabel(aiProvider, model)
          const totalCost = route === 'deepseek-cloak' ? 0 : completionCost(aiProvider, model, promptTokens, completionTokens, getCachedModels())
          event.sender.send(IPC_CHANNELS.AI_STREAM_DONE, {
            promptTokens,
            completionTokens,
            totalTokens,
            totalCost,
            model: modelLabel
          })
        }
      },
      onError: (error: string) => {
        if (isCurrent()) {
          event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, error)
        }
      }
    }

    if (effectiveCoachMode && coachInstantReply) {
      streamCallbacks.onChunk(coachInstantReply)
      streamCallbacks.onDone()
      return
    }

    if (workCoachEscalation !== null && geminiApiKey.trim()) {
      const finishWorkCoach = (modelLabel: string, primaryContent: string) => {
        if (!isCurrent()) return
        if (coachDebugPath && completionContent.trim()) {
          patchCoachDebugCompletion(coachDebugPath, completionContent)
        }
        if (effectiveCoachMode && assistantMode === 'work' && primaryContent.trim()) {
          updateWorkCoachThread(screenText, screenMetadata, primaryContent, {
            triggerReview: workCoachCodeReview.status
          })
        }
        if (isCurrent()) {
          const completionTokens = estimateTokens(completionContent)
          event.sender.send(IPC_CHANNELS.AI_STREAM_DONE, {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            totalCost: 0,
            model: modelLabel
          })
        }
      }

      try {
        const includeDeepseekCompare =
          cloakDeepseekProfileReady() &&
          !!(useVision && screenScreenshot && !coachInstantReply)

        const isVisualQuiz = workProblemProfile?.kind === 'visual-quiz'
        if (isVisualQuiz && useVision && screenScreenshot && !coachInstantReply) {
          const sessionKey = workSessionKey(screenText, screenMetadata)
          const result = await runWorkCoachQuizVision({
            messages,
            geminiApiKey,
            screenScreenshot,
            includeDeepseekCompare,
            event: target,
            sessionKey
          })
          completionContent = result.completionContent
          finishWorkCoach(result.modelLabel, result.primaryPanelContent)
          return
        }

        const result = await runWorkCoachEscalation({
          messages,
          geminiApiKey,
          useVision: useVision && !coachInstantReply,
          includeDeepseekCompare,
          includeCursor: workProblemProfile ? shouldUseCursorWorkCoach(workProblemProfile) : false,
          screenScreenshot,
          screenText,
          screenMetadata,
          event: target
        })
        if (result.completionContent.trim()) {
          completionContent = result.completionContent
        }
        finishWorkCoach(result.modelLabel, result.primaryPanelContent)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Work coach failed'
        streamCallbacks.onError(message)
      }
      return
    }

    await completionGateway.stream(route, {
      messages, model, apiKey: route === 'deepseek-cloak' ? '' : apiKey,
      screenshot: useVision && !coachInstantReply ? screenScreenshot : undefined
    }, streamCallbacks)
  })

  // Cancel AI stream
  ipcMain.on(IPC_CHANNELS.AI_CANCEL, (event) => {
    requests.invalidate(event.sender)
    markQuizUserActivity()
    completionGateway.cancel()
  })

}
