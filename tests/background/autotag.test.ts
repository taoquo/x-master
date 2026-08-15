import test from "node:test"
import assert from "node:assert/strict"
import { createBackgroundMessageHandler } from "../../src/background/index.ts"
import {
  AUTOTAG_RUN_MESSAGE,
  RUN_SYNC_MESSAGE,
  SUGGESTIONS_ACCEPT_BULK_MESSAGE,
  SUGGESTIONS_ACCEPT_MESSAGE,
  SUGGESTIONS_REJECT_MESSAGE
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
