// MV3 service workers are terminated after roughly 30 seconds without an event.
// A batched auto-tag run is mostly `await`s: a pending fetch counts as activity,
// but the gaps do not - a rate-limit backoff sleeps on setTimeout, which does
// not keep the worker alive, and neither does the storage write between batches.
// A worker killed in one of those gaps takes the run with it, and the only trace
// left is a run state whose heartbeat stopped moving.
//
// A periodic alarm is the supported way to keep a worker alive: every firing is
// an event, and an event resets the idle timer. The listener deliberately does
// nothing; being woken is the entire point.
const KEEP_ALIVE_ALARM = "runtime/keep-alive"

// Chrome clamps alarm periods to 30 seconds, which is exactly the idle window,
// so ask for the shortest period the platform will honour.
const KEEP_ALIVE_PERIOD_IN_MINUTES = 0.5

type AlarmsApi = {
  create: (name: string, info: { periodInMinutes: number }) => void
  clear: (name: string) => void | Promise<boolean>
  onAlarm?: { addListener: (listener: () => void) => void }
}

function getAlarms(): AlarmsApi | null {
  if (typeof chrome === "undefined") {
    return null
  }

  const alarms = (chrome as { alarms?: Partial<AlarmsApi> }).alarms
  if (!alarms?.create || !alarms.clear) {
    return null
  }

  return alarms as AlarmsApi
}

let listenerAttached = false
// Reference counted so overlapping callers cannot cancel each other's keepalive.
let holders = 0

function attachListenerOnce(alarms: AlarmsApi) {
  if (listenerAttached || !alarms.onAlarm?.addListener) {
    return
  }

  listenerAttached = true
  alarms.onAlarm.addListener(() => {
    // Intentionally empty: waking the worker is the whole effect.
  })
}

export function startKeepAlive() {
  const alarms = getAlarms()
  if (!alarms) {
    return
  }

  holders += 1

  if (holders > 1) {
    return
  }

  attachListenerOnce(alarms)
  alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: KEEP_ALIVE_PERIOD_IN_MINUTES })
}

export function stopKeepAlive() {
  const alarms = getAlarms()
  if (!alarms) {
    return
  }

  holders = Math.max(0, holders - 1)

  if (holders > 0) {
    return
  }

  try {
    void alarms.clear(KEEP_ALIVE_ALARM)
  } catch {
    // Clearing is best-effort: a stray periodic alarm only wakes an idle worker.
  }
}

// Exposed for tests, which need to assert the reference counting without
// reaching into module state.
export function getKeepAliveHolderCount() {
  return holders
}

export { KEEP_ALIVE_ALARM, KEEP_ALIVE_PERIOD_IN_MINUTES }
