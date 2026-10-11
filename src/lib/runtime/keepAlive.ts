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
// Bumped on every create/abandon. A clear is asynchronous while create is not,
// so a clear that resolves after a newer create must not be allowed to leave the
// newer run unprotected.
let alarmGeneration = 0

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
  alarmGeneration += 1
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

  const generation = alarmGeneration

  try {
    void Promise.resolve(alarms.clear(KEEP_ALIVE_ALARM))
      .then(() => {
        // A new run armed the alarm while this clear was in flight. Honouring the
        // newer intent means re-arming, otherwise the run that just started runs
        // unprotected and can be killed in the next 30 second idle gap.
        if (generation !== alarmGeneration && holders > 0) {
          alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: KEEP_ALIVE_PERIOD_IN_MINUTES })
        }
      })
      .catch(() => {})
  } catch {
    // Clearing is best-effort: a stray periodic alarm only wakes an idle worker.
  }
}

// A wedged run never reaches its own `finally`, so its holder is never released
// and the periodic alarm keeps waking the worker forever. Taking over such a run
// abandons it explicitly, which is the only way the holder count comes back down.
export function releaseKeepAliveForAbandonedRun() {
  const alarms = getAlarms()
  if (!alarms) {
    return
  }

  holders = 0
  // Invalidates any in-flight clear's re-arm check: nobody holds the alarm now.
  alarmGeneration += 1

  try {
    void Promise.resolve(alarms.clear(KEEP_ALIVE_ALARM)).catch(() => {})
  } catch {
    // Best-effort, same as stopKeepAlive.
  }
}

// Exposed for tests, which need to assert the reference counting without
// reaching into module state.
export function getKeepAliveHolderCount() {
  return holders
}

export { KEEP_ALIVE_ALARM, KEEP_ALIVE_PERIOD_IN_MINUTES }
