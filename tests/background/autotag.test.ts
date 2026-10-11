import test from "node:test"
import assert from "node:assert/strict"
import { createBackgroundMessageHandler, reconcileInterruptedRuns } from "../../src/background/index.ts"
import { KEEP_ALIVE_ALARM } from "../../src/lib/runtime/keepAlive.ts"
import { AUTO_TAG_RUN_LIVENESS_MS, AUTO_TAG_RUN_STALE_MS, getSettings } from "../../src/lib/storage/settings.ts"
import {
  AUTOTAG_CANCEL_MESSAGE,
  AUTOTAG_RUN_MESSAGE,
  RESET_LOCAL_DATA_MESSAGE,
  RUN_SYNC_MESSAGE,
  SUGGESTIONS_ACCEPT_BULK_MESSAGE,
  SUGGESTIONS_ACCEPT_MESSAGE,
  SUGGESTIONS_REJECT_MESSAGE,
  TAG_VOCABULARY_REVIEW_MESSAGE
} from "../../src/lib/runtime/messages.ts"
import type { WorkspaceData } from "../../src/lib/types.ts"

function makeWorkspaceData(): WorkspaceData {
  return {
    bookmarks: [],
    tags: [],
    bookmarkTags: [],
    tagSuggestions: [],
    savedViews: [],
    latestSyncRun: null,
    summary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    stats: {
      totalBookmarks: 0,
      unclassifiedCount: 0,
      pendingSuggestionCount: 0,
      tagCounts: [],
      topAuthors: []
    }
  }
}

async function flushBackgroundTasks() {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test("autotag/run starts once and rejects concurrent runs", async () => {
  let runCount = 0
  let releaseRun: () => void = () => {}
  const runGate = new Promise<void>((resolve) => {
    releaseRun = resolve
  })

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    runAutoTag: async () => {
      runCount += 1
      await runGate
    }
  })

  const first = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as { started: boolean }
  const second = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as { started: boolean; alreadyRunning?: boolean }

  assert.equal(first.started, true)
  assert.equal(second.started, false)
  assert.equal(second.alreadyRunning, true)
  assert.equal(runCount, 1)

  releaseRun()
  await flushBackgroundTasks()

  const third = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as { started: boolean }
  assert.equal(third.started, true)
})

test("a successful sync triggers auto-tagging when enabled after sync", async () => {
  let autoTagRuns = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    runAutoTag: async () => {
      autoTagRuns += 1
    },
    shouldAutoTagAfterSync: async () => true
  })

  await handler({ type: RUN_SYNC_MESSAGE })
  await flushBackgroundTasks()

  assert.equal(autoTagRuns, 1)
})

test("a successful sync skips auto-tagging when disabled", async () => {
  let autoTagRuns = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    runAutoTag: async () => {
      autoTagRuns += 1
    },
    shouldAutoTagAfterSync: async () => false
  })

  await handler({ type: RUN_SYNC_MESSAGE })
  await flushBackgroundTasks()

  assert.equal(autoTagRuns, 0)
})

test("a successful sync backfills hashtags even when auto-tagging is disabled", async () => {
  let backfillRuns = 0
  let autoTagRuns = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    runAutoTag: async () => {
      autoTagRuns += 1
    },
    shouldAutoTagAfterSync: async () => false,
    backfillHashtags: async () => {
      backfillRuns += 1
    }
  })

  await handler({ type: RUN_SYNC_MESSAGE })
  await flushBackgroundTasks()

  // Auto-tagging is off by default, which used to make the one-time hashtag
  // backfill unreachable: it lived behind the pipeline's enable gate.
  assert.equal(backfillRuns, 1)
  assert.equal(autoTagRuns, 0)
})

test("a failed sync does not backfill hashtags", async () => {
  let backfillRuns = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => {
      throw new Error("sync exploded")
    },
    backfillHashtags: async () => {
      backfillRuns += 1
    }
  })

  await handler({ type: RUN_SYNC_MESSAGE })
  await flushBackgroundTasks()

  assert.equal(backfillRuns, 0)
})

test("a failing hashtag backfill does not fail the sync", async () => {
  let autoTagRuns = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    runAutoTag: async () => {
      autoTagRuns += 1
    },
    shouldAutoTagAfterSync: async () => true,
    backfillHashtags: async () => {
      throw new Error("backfill exploded")
    }
  })

  await handler({ type: RUN_SYNC_MESSAGE })
  await flushBackgroundTasks()

  // Best-effort migration: the post-sync auto-tag run still has to happen.
  assert.equal(autoTagRuns, 1)
})

function uninstallChrome() {
  delete (globalThis as unknown as Record<string, unknown>).chrome
}

// Key-addressed storage so a test can seed a persisted run state (the only
// cross-worker evidence that a run is alive) and read back what was written.
function installKeyedStorageMock(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial }

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async (key?: string) => (key ? { [key]: store[key] } : { ...store }),
        set: async (value: Record<string, unknown>) => {
          Object.assign(store, value)
        }
      }
    }
  }

  return store
}

function persistedRunState(overrides: Record<string, unknown> = {}) {
  return {
    autoTagRunState: {
      runId: "run-persisted",
      startedAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
      phase: "llm",
      processed: 1,
      total: 9,
      ...overrides
    }
  }
}

test("a slow but alive run is not taken over just because its start is old", async () => {
  let runCount = 0
  // Frozen clock: the persisted heartbeat below is what says the run is alive.
  const clock = Date.parse("2026-08-21T00:10:00.000Z")

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    now: () => clock,
    runAutoTag: () => {
      runCount += 1
      return new Promise<void>(() => {})
    }
  })

  try {
    // A run whose start is far in the past but whose heartbeat is current: the
    // in-memory timestamp alone declared this dead and started a second pipeline
    // on top of it, so two runs spent on the same bookmarks.
    installKeyedStorageMock({
      settings: persistedRunState({
        startedAt: new Date(clock - AUTO_TAG_RUN_STALE_MS * 4).toISOString(),
        updatedAt: new Date(clock - 1_000).toISOString()
      })
    })

    const first = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as { started: boolean; alreadyRunning?: boolean }

    assert.equal(first.started, false)
    assert.equal(first.alreadyRunning, true)
    assert.equal(runCount, 0)
  } finally {
    uninstallChrome()
  }
})

test("a run whose heartbeat stopped is taken over", async () => {
  let runCount = 0
  const clock = Date.parse("2026-08-21T00:10:00.000Z")

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    now: () => clock,
    runAutoTag: () => {
      runCount += 1
      return Promise.resolve()
    }
  })

  try {
    installKeyedStorageMock({
      settings: persistedRunState({
        updatedAt: new Date(clock - AUTO_TAG_RUN_STALE_MS - 1).toISOString()
      })
    })

    const started = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as { started: boolean }

    // A frozen heartbeat means the worker died holding the run: take over.
    assert.equal(started.started, true)
    assert.equal(runCount, 1)
  } finally {
    uninstallChrome()
  }
})

test("a run silent past the liveness window is taken over before the stale window", async () => {
  let runCount = 0
  const clock = Date.parse("2026-08-21T00:10:00.000Z")

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    now: () => clock,
    runAutoTag: () => {
      runCount += 1
      return Promise.resolve()
    }
  })

  try {
    // Silence longer than a batch cap means the run is gone, even though the
    // UI-facing stale window has not elapsed. Using the longer window here would
    // let a dead run refuse new runs for five minutes.
    installKeyedStorageMock({
      settings: persistedRunState({
        updatedAt: new Date(clock - AUTO_TAG_RUN_LIVENESS_MS - 1).toISOString()
      })
    })

    const started = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as { started: boolean }

    assert.equal(started.started, true)
    assert.equal(runCount, 1)
  } finally {
    uninstallChrome()
  }
})

test("a hung sync can be taken over once it goes stale", async () => {
  let syncCount = 0
  let clock = 5_000_000

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    now: () => clock,
    // Never settles: the shape of a sync that wedged mid-page.
    runSync: () => {
      syncCount += 1
      return new Promise<void>(() => {})
    }
  })

  const first = (await handler({ type: RUN_SYNC_MESSAGE })) as { started: boolean }
  assert.equal(first.started, true)

  const blocked = (await handler({ type: RUN_SYNC_MESSAGE })) as { started: boolean; alreadyRunning?: boolean }
  assert.equal(blocked.started, false)
  assert.equal(blocked.alreadyRunning, true)

  // A sync used to have no escape at all: one hung run answered "already
  // running" forever, with no way back short of reloading the extension.
  clock += AUTO_TAG_RUN_STALE_MS + 1
  const takeover = (await handler({ type: RUN_SYNC_MESSAGE })) as {
    started: boolean
    tookOverStaleRun?: boolean
  }

  assert.equal(takeover.started, true)
  assert.equal(takeover.tookOverStaleRun, true)
  assert.equal(syncCount, 2)
})

test("reset clears the in-flight run state and releases the run lock", async () => {
  let resetCalls = 0
  const clock = Date.parse("2026-08-21T00:10:00.000Z")

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => {
      resetCalls += 1
      return { success: true }
    },
    runSync: async () => ({}),
    now: () => clock,
    runAutoTag: () => new Promise<void>(() => {})
  })

  try {
    const store = installKeyedStorageMock({
      settings: persistedRunState({ updatedAt: new Date(clock - 1_000).toISOString() })
    })

    await handler({ type: RESET_LOCAL_DATA_MESSAGE })

    assert.equal(resetCalls, 1)
    // A live pipeline writes into the stores the reset just emptied, so the
    // reset must first take ownership of the run state away from it.
    assert.equal((store.settings as { autoTagRunState?: unknown }).autoTagRunState, undefined)

    // With the state cleared the lock is free, so the next run starts instead of
    // being refused by a run that no longer exists.
    const restarted = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as { started: boolean }
    assert.equal(restarted.started, true)
  } finally {
    uninstallChrome()
  }
})

test("startup reconciles a sync the previous worker left running", async () => {
  try {
    installKeyedStorageMock({
      settings: {
        lastSyncSummary: {
          status: "running",
          fetchedCount: 3,
          insertedCount: 1,
          updatedCount: 0,
          failedCount: 0,
          lastSyncedAt: "2026-08-21T00:00:00.000Z"
        },
        autoTagRunState: persistedRunState().autoTagRunState
      }
    })

    await reconcileInterruptedRuns()

    const settings = (await getSettings()) as {
      lastSyncSummary: { status: string; errorKind?: string }
      autoTagRunState?: unknown
    }

    // A sync only ever runs inside the worker that started it, so "running" found
    // at startup belongs to a worker that is already gone. Left alone it stayed
    // "running" forever and every popup polled for the full ten minutes.
    assert.equal(settings.lastSyncSummary.status, "error")
    assert.equal(settings.lastSyncSummary.errorKind, "interrupted")
    assert.equal(settings.autoTagRunState, undefined)
  } finally {
    uninstallChrome()
  }
})

test("startup leaves a terminal sync summary alone", async () => {
  try {
    installKeyedStorageMock({
      settings: {
        lastSyncSummary: {
          status: "success",
          fetchedCount: 5,
          insertedCount: 2,
          updatedCount: 3,
          failedCount: 0,
          lastSyncedAt: "2026-08-21T00:00:00.000Z"
        }
      }
    })

    await reconcileInterruptedRuns()

    const settings = (await getSettings()) as { lastSyncSummary: { status: string; fetchedCount: number } }
    assert.equal(settings.lastSyncSummary.status, "success")
    assert.equal(settings.lastSyncSummary.fetchedCount, 5)
  } finally {
    uninstallChrome()
  }
})

test("suggestion accept/reject/bulk messages route to the injected handlers", async () => {
  const calls: Array<[string, unknown]> = []

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    acceptSuggestion: async (suggestionId) => {
      calls.push(["accept", suggestionId])
      return null
    },
    rejectSuggestion: async (suggestionId) => {
      calls.push(["reject", suggestionId])
      return null
    },
    acceptSuggestionsBulk: async (suggestionIds) => {
      calls.push(["bulk", suggestionIds])
      return { acceptedCount: suggestionIds.length }
    }
  })

  await handler({ type: SUGGESTIONS_ACCEPT_MESSAGE, suggestionId: "s1" })
  await handler({ type: SUGGESTIONS_REJECT_MESSAGE, suggestionId: "s2" })
  const bulkResponse = (await handler({ type: SUGGESTIONS_ACCEPT_BULK_MESSAGE, suggestionIds: ["s3", "s4"] })) as {
    acceptedCount: number
  }

  assert.deepEqual(calls, [
    ["accept", "s1"],
    ["reject", "s2"],
    ["bulk", ["s3", "s4"]]
  ])
  assert.equal(bulkResponse.acceptedCount, 2)
})

test("the vocabulary review message answers synchronously from the injected handler", async () => {
  let calls = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    reviewTagVocabulary: async () => {
      calls += 1
      return {
        ok: true,
        merges: [
          { targetTagId: "t1", targetName: "llm", sourceTagIds: ["t2"], sourceNames: ["llms"], reason: "same concept" }
        ],
        renames: []
      }
    }
  })

  const response = (await handler({ type: TAG_VOCABULARY_REVIEW_MESSAGE })) as {
    ok: boolean
    merges: Array<{ targetTagId: string }>
  }

  assert.equal(calls, 1)
  assert.equal(response.ok, true)
  assert.deepEqual(
    response.merges.map((plan) => plan.targetTagId),
    ["t1"]
  )
})

// Regression: the lock used to be a bare boolean cleared only by the run's own
// finally block. A wedged run therefore held it forever and every later trigger
// answered "already running", with no way back short of reloading the extension.
test("a wedged auto-tag run is taken over once it goes stale", async () => {
  let runCount = 0
  let clock = 1_000_000

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    now: () => clock,
    // Never settles: exactly the shape of a hung gateway request.
    runAutoTag: () => {
      runCount += 1
      return new Promise<void>(() => {})
    }
  })

  const first = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as { started: boolean }
  assert.equal(first.started, true)

  const blocked = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as {
    started: boolean
    alreadyRunning?: boolean
  }
  assert.equal(blocked.started, false)
  assert.equal(blocked.alreadyRunning, true)
  assert.equal(runCount, 1)

  // The wedged run is still holding the lock, but its start is now older than
  // the stale window, so a new run may take over.
  clock += AUTO_TAG_RUN_STALE_MS + 1

  const takeover = (await handler({ type: AUTOTAG_RUN_MESSAGE })) as {
    started: boolean
    tookOverStaleRun?: boolean
  }

  assert.equal(takeover.started, true)
  assert.equal(takeover.tookOverStaleRun, true)
  assert.equal(runCount, 2)
})

test("autotag/cancel records the request through the injected handler", async () => {
  let cancelCalls = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => makeWorkspaceData(),
    resetData: async () => ({ success: true }),
    runSync: async () => ({}),
    runAutoTag: async () => {},
    cancelAutoTag: async () => {
      cancelCalls += 1
      return true
    }
  })

  const result = (await handler({ type: AUTOTAG_CANCEL_MESSAGE })) as { cancelRequested: boolean }

  assert.equal(cancelCalls, 1)
  assert.deepEqual(result, { cancelRequested: true })
})

// An MV3 worker is terminated after ~30s idle. A batched run is mostly waiting,
// and the gaps between batches (a backoff sleeping on setTimeout, the storage
// write between batches) do not count as activity, so without a keepalive the
// worker can be recycled mid-run and take the run with it.
test("a run holds a keepalive alarm until it finishes", async () => {
  const created: string[] = []
  const cleared: string[] = []
  let releaseRun: () => void = () => {}
  const runGate = new Promise<void>((resolve) => {
    releaseRun = resolve
  })

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    alarms: {
      create: (name: string) => {
        created.push(name)
      },
      clear: async (name: string) => {
        cleared.push(name)
        return true
      },
      onAlarm: { addListener: () => {} }
    }
  }

  try {
    const handler = createBackgroundMessageHandler({
      loadWorkspaceData: async () => makeWorkspaceData(),
      resetData: async () => ({ success: true }),
      runSync: async () => ({}),
      runAutoTag: async () => {
        await runGate
      }
    })

    await handler({ type: AUTOTAG_RUN_MESSAGE })

    assert.deepEqual(created, [KEEP_ALIVE_ALARM])
    assert.deepEqual(cleared, [], "the keepalive must outlive the batches, not the trigger")

    releaseRun()
    await flushBackgroundTasks()

    // Held for exactly as long as the run, so an idle worker is not kept awake.
    assert.deepEqual(cleared, [KEEP_ALIVE_ALARM])
  } finally {
    delete (globalThis as unknown as Record<string, unknown>).chrome
  }
})
