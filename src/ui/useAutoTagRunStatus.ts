import { useCallback, useEffect, useRef, useState } from "react"
import { AUTOTAG_CANCEL_MESSAGE } from "../lib/runtime/messages.ts"
import { subscribeAutoTagProgress } from "../lib/runtime/autotagProgress.ts"
import type { AutoTagProgress } from "../lib/runtime/autotagProgress.ts"
import { SETTINGS_STORAGE_KEY, getSettings, isAutoTagRunActive } from "../lib/storage/settings.ts"
import type { AutoTagRunState } from "../lib/types.ts"

// A heartbeat that stops moving while a batch is in flight means "the provider is
// slow or the request is wedged" long before the run is declared dead. This is the
// threshold where the UI says so instead of showing a frozen bar.
const STALL_HINT_MS = 8_000

export interface AutoTagRunProgress {
  isActive: boolean
  status: "running" | "waiting" | "cancelling"
  phase: "heuristics" | "llm"
  processed: number
  total: number
  percent: number
  // True once the heartbeat has gone quiet for a while, which is what the UI
  // shows as "waiting on the provider" rather than a bar that looks stuck.
  isStalled: boolean
  secondsSinceHeartbeat: number
  // Set while a provider has asked us to back off.
  waitingSecondsLeft?: number
  inFlight: boolean
  elapsedSeconds: number
  // Only offered once there is enough progress for the average to mean anything.
  etaSeconds?: number
  providerId?: string
  model?: string
  startedAt?: string
}

const IDLE: AutoTagRunProgress = {
  isActive: false,
  status: "running",
  phase: "heuristics",
  processed: 0,
  total: 0,
  percent: 0,
  isStalled: false,
  secondsSinceHeartbeat: 0,
  inFlight: false,
  elapsedSeconds: 0
}

function fromState(state: AutoTagRunState | undefined, nowMs: number): AutoTagRunProgress {
  if (!state || !isAutoTagRunActive(state, nowMs)) {
    return IDLE
  }

  const heartbeatMs = Date.parse(state.updatedAt)
  const startedMs = Date.parse(state.startedAt)
  const secondsSinceHeartbeat = Number.isFinite(heartbeatMs) ? Math.max(0, Math.round((nowMs - heartbeatMs) / 1000)) : 0
  const elapsedSeconds = Number.isFinite(startedMs) ? Math.max(0, Math.round((nowMs - startedMs) / 1000)) : 0
  const total = Math.max(0, state.total)
  const processed = Math.min(Math.max(0, state.processed), total || Number.MAX_SAFE_INTEGER)
  const waitingSecondsLeft =
    state.waitingUntilMs !== undefined && state.waitingUntilMs > nowMs
      ? Math.ceil((state.waitingUntilMs - nowMs) / 1000)
      : undefined

  // An average over too few finished items is noise, so no estimate is offered
  // until at least one batch has completed.
  const etaSeconds =
    processed > 0 && total > processed && elapsedSeconds > 0
      ? Math.max(1, Math.round((elapsedSeconds / processed) * (total - processed)))
      : undefined

  return {
    isActive: true,
    status: state.status ?? (state.cancelRequested ? "cancelling" : "running"),
    phase: state.phase,
    processed,
    total,
    percent: total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0,
    isStalled: waitingSecondsLeft === undefined && secondsSinceHeartbeat * 1000 >= STALL_HINT_MS,
    secondsSinceHeartbeat,
    ...(waitingSecondsLeft === undefined ? {} : { waitingSecondsLeft }),
    inFlight: Boolean(state.inFlight),
    elapsedSeconds,
    ...(etaSeconds === undefined ? {} : { etaSeconds }),
    ...(state.providerId ? { providerId: state.providerId } : {}),
    ...(state.model ? { model: state.model } : {}),
    startedAt: state.startedAt
  }
}

// One source of truth for "what is the auto-tag run doing", shared by the sidebar,
// the popup and the settings panel.
//
// The persisted run state is the authority: the pipeline writes it on every batch
// boundary, so a freshly opened or refreshed page renders the right numbers
// immediately. The live broadcast only lowers the latency between those writes —
// losing it costs freshness, never correctness, which is what made progress
// invisible after a refresh before.
export function useAutoTagRunStatus(): AutoTagRunProgress & { cancel: () => Promise<boolean> } {
  const [state, setState] = useState<AutoTagRunState | undefined>(undefined)
  const [live, setLive] = useState<AutoTagProgress | undefined>(undefined)
  const [nowMs, setNowMs] = useState(() => Date.now())
  // The broadcast carries no timestamp, so its arrival time is the heartbeat the
  // stall indicator uses until the next persisted write lands.
  const liveAtRef = useRef(0)

  // When the persisted state was last read. A broadcast newer than this is fresher
  // information than we have, which is the only thing that justifies rendering it
  // while the state says "no run".
  const lastReadAtRef = useRef(0)

  const readSettings = useCallback(async () => {
    const settings = await getSettings().catch(() => undefined)
    if (settings) {
      lastReadAtRef.current = Date.now()
      setState(settings.autoTagRunState)
    }
  }, [])

  useEffect(() => {
    void readSettings()

    const unsubscribeProgress = subscribeAutoTagProgress((progress) => {
      liveAtRef.current = Date.now()
      setLive(progress)
    })

    const onStorageChanged =
      typeof chrome !== "undefined" && typeof chrome.storage?.onChanged?.addListener === "function"
        ? (changes: Record<string, unknown>, area: string) => {
            if (area === "local" && SETTINGS_STORAGE_KEY in changes) {
              void readSettings()
            }
          }
        : null

    if (onStorageChanged) {
      chrome.storage.onChanged.addListener(onStorageChanged)
    }

    return () => {
      unsubscribeProgress()
      if (onStorageChanged) {
        chrome.storage.onChanged.removeListener(onStorageChanged)
      }
    }
  }, [readSettings])

  // Re-render exactly when the stall verdict can change, rather than every second.
  // A perpetual 1s interval is harmless in a browser page but keeps a Node test
  // process alive and starves its settle() helper, which made whole test files hang;
  // and the only moment the display genuinely needs to change without an event is the
  // transition into "no heartbeat", so that is the single timer scheduled here.
  const heartbeatMs = state === undefined ? Number.NaN : Date.parse(state.updatedAt)
  const lastEventMs = Number.isFinite(heartbeatMs) ? Math.max(heartbeatMs, liveAtRef.current) : liveAtRef.current
  const runIsActive = state !== undefined && isAutoTagRunActive(state, nowMs)
  const stallPending = runIsActive && Number.isFinite(lastEventMs) && nowMs - lastEventMs < STALL_HINT_MS

  useEffect(() => {
    if (!stallPending) {
      return
    }

    const delay = Math.max(0, STALL_HINT_MS - (Date.now() - lastEventMs))
    const timer = setTimeout(() => setNowMs(Date.now()), delay)
    return () => clearTimeout(timer)
  }, [stallPending, lastEventMs])

  const cancel = useCallback(async () => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      return false
    }

    const response = (await chrome.runtime.sendMessage({ type: AUTOTAG_CANCEL_MESSAGE }).catch(() => undefined)) as
      | { cancelRequested?: boolean }
      | undefined

    return Boolean(response?.cancelRequested)
  }, [])

  // The persisted state is authoritative: it is what makes a finished run clear its
  // progress instead of leaving a frozen line behind. A broadcast is only rendered
  // when the state does not show an active run AND the broadcast is newer than the
  // state we read — i.e. it is information we do not have yet, which covers the
  // moment between a run starting and its first persisted write landing.
  const liveAgeMs = live === undefined ? Number.POSITIVE_INFINITY : nowMs - liveAtRef.current
  const persisted = fromState(state, nowMs)
  const liveIsUsable = !persisted.isActive && live !== undefined && liveAtRef.current > lastReadAtRef.current

  if (!persisted.isActive && !liveIsUsable) {
    return { ...IDLE, cancel }
  }

  const total = Math.max(0, liveIsUsable && live ? live.total : persisted.total)
  const rawProcessed = liveIsUsable && live ? live.processed : persisted.processed
  const processed = Math.min(Math.max(0, rawProcessed), total || Number.MAX_SAFE_INTEGER)
  const secondsSinceHeartbeat = liveIsUsable
    ? Math.max(0, Math.round(liveAgeMs / 1000))
    : persisted.secondsSinceHeartbeat
  const waitingUntilMs = liveIsUsable && live ? live.waitingUntilMs : state?.waitingUntilMs
  const waitingSecondsLeft =
    waitingUntilMs !== undefined && waitingUntilMs > nowMs ? Math.ceil((waitingUntilMs - nowMs) / 1000) : undefined
  const status = (liveIsUsable && live?.status) || persisted.status
  const isWaiting = waitingSecondsLeft !== undefined || status === "waiting"

  return {
    isActive: true,
    status,
    phase: liveIsUsable && live ? live.phase : persisted.phase,
    processed,
    total,
    percent: total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : persisted.percent,
    isStalled: !isWaiting && secondsSinceHeartbeat * 1000 >= STALL_HINT_MS,
    secondsSinceHeartbeat,
    ...(waitingSecondsLeft === undefined ? {} : { waitingSecondsLeft }),
    inFlight: (liveIsUsable && live?.inFlight) ?? persisted.inFlight,
    elapsedSeconds: persisted.elapsedSeconds,
    ...(persisted.etaSeconds === undefined ? {} : { etaSeconds: persisted.etaSeconds }),
    ...((liveIsUsable && live?.providerId) || persisted.providerId
      ? { providerId: (liveIsUsable && live?.providerId) || persisted.providerId }
      : {}),
    ...((liveIsUsable && live?.model) || persisted.model
      ? { model: (liveIsUsable && live?.model) || persisted.model }
      : {}),
    ...(persisted.startedAt ? { startedAt: persisted.startedAt } : {}),
    cancel
  }
}
