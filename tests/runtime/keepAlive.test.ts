import test from "node:test"
import assert from "node:assert/strict"
import {
  getKeepAliveHolderCount,
  KEEP_ALIVE_ALARM,
  KEEP_ALIVE_PERIOD_IN_MINUTES,
  releaseKeepAliveForAbandonedRun,
  startKeepAlive,
  stopKeepAlive
} from "../../src/lib/runtime/keepAlive.ts"

type AlarmCall = { name: string; periodInMinutes: number }

function installAlarmsMock({ withOnAlarm = true }: { withOnAlarm?: boolean } = {}) {
  const created: AlarmCall[] = []
  const cleared: string[] = []
  const listeners: Array<() => void> = []

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    alarms: {
      create: (name: string, info: { periodInMinutes: number }) => {
        created.push({ name, periodInMinutes: info.periodInMinutes })
      },
      clear: async (name: string) => {
        cleared.push(name)
        return true
      },
      ...(withOnAlarm
        ? {
            onAlarm: {
              addListener: (listener: () => void) => {
                listeners.push(listener)
              }
            }
          }
        : {})
    }
  }

  return { created, cleared, listeners }
}

function removeChrome() {
  delete (globalThis as unknown as Record<string, unknown>).chrome
}

// Every test shares module-level reference counting, so unwind it explicitly.
test.afterEach(() => {
  while (getKeepAliveHolderCount() > 0) {
    stopKeepAlive()
  }
  removeChrome()
})

test("the first holder creates a periodic alarm and attaches one waking listener", () => {
  const { created, listeners } = installAlarmsMock()

  startKeepAlive()

  assert.deepEqual(created, [{ name: KEEP_ALIVE_ALARM, periodInMinutes: KEEP_ALIVE_PERIOD_IN_MINUTES }])
  // Chrome kills an idle worker at 30s, so a longer period would not keep it up.
  assert.ok(KEEP_ALIVE_PERIOD_IN_MINUTES * 60 <= 30)
  // A firing alarm only wakes the worker if something is listening for it.
  assert.equal(listeners.length, 1)
})

// The sync path can start an auto-tag run, so two holders overlap by design.
// Reference counting is what stops the inner one's release from cancelling the
// keepalive the outer one still needs.
test("overlapping holders share one alarm and only the last release clears it", () => {
  const { created, cleared } = installAlarmsMock()

  startKeepAlive()
  startKeepAlive()

  assert.equal(created.length, 1)
  assert.equal(getKeepAliveHolderCount(), 2)

  stopKeepAlive()
  assert.deepEqual(cleared, [], "the alarm must survive while a holder remains")

  stopKeepAlive()
  assert.deepEqual(cleared, [KEEP_ALIVE_ALARM])
  assert.equal(getKeepAliveHolderCount(), 0)
})

test("re-arming the keepalive never registers a second listener", () => {
  const { created, listeners } = installAlarmsMock()

  startKeepAlive()
  stopKeepAlive()
  startKeepAlive()

  // The handler is attached once for the worker's whole lifetime. Re-registering
  // per run would pile up listeners on a worker that may serve many runs, so a
  // fresh arming creates the alarm again but adds no listener.
  assert.equal(created.length, 2)
  assert.equal(listeners.length, 0)
})

test("an unbalanced release cannot drive the holder count negative", () => {
  installAlarmsMock()

  stopKeepAlive()
  assert.equal(getKeepAliveHolderCount(), 0)

  // A stray release must not leave the next real run unprotected.
  const { created } = installAlarmsMock()
  startKeepAlive()
  assert.equal(created.length, 1)
})

test("keepalive is a no-op without the alarms api", () => {
  removeChrome()
  assert.doesNotThrow(() => startKeepAlive())
  assert.doesNotThrow(() => stopKeepAlive())
  assert.equal(getKeepAliveHolderCount(), 0)

  // A build without the permission still has to run, just without keepalive.
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {}
  assert.doesNotThrow(() => startKeepAlive())
  assert.equal(getKeepAliveHolderCount(), 0)
})

test("a missing onAlarm hook does not stop the alarm from being created", () => {
  const { created } = installAlarmsMock({ withOnAlarm: false })

  assert.doesNotThrow(() => startKeepAlive())
  assert.deepEqual(created, [{ name: KEEP_ALIVE_ALARM, periodInMinutes: KEEP_ALIVE_PERIOD_IN_MINUTES }])
})

// A wedged run never reaches its own finally block, so nothing ever releases the
// holder it took. Left alone, the holder count never returns to zero and the
// periodic alarm wakes the worker every 30s for the life of the worker.
test("abandoning a wedged run releases its leaked holder and clears the alarm", () => {
  const { cleared } = installAlarmsMock()

  startKeepAlive()
  assert.equal(getKeepAliveHolderCount(), 1)

  releaseKeepAliveForAbandonedRun()

  assert.equal(getKeepAliveHolderCount(), 0)
  assert.deepEqual(cleared, [KEEP_ALIVE_ALARM])
})

test("a run starting while a clear is in flight still ends up protected", async () => {
  const events: string[] = []
  let releaseClear: () => void = () => {}
  const clearGate = new Promise<void>((resolve) => {
    releaseClear = resolve
  })

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    alarms: {
      create: () => {
        events.push("create")
      },
      clear: async () => {
        // Resolves only when the test lets it, which is the ordering that used to
        // leave the new run unprotected.
        await clearGate
        events.push("clear")
        return true
      },
      onAlarm: { addListener: () => {} }
    }
  }

  startKeepAlive()
  stopKeepAlive()
  // The clear is pending; a new run arrives in the same task.
  startKeepAlive()

  releaseClear()
  await clearGate
  await new Promise((resolve) => setTimeout(resolve, 0))

  // The late clear deleted the alarm the new run had armed, so the keepalive must
  // re-arm it: otherwise that run can be killed in the next 30 second idle gap.
  assert.deepEqual(events, ["create", "create", "clear", "create"])
  assert.equal(events[events.length - 1], "create")
})
