import test from "node:test"
import assert from "node:assert/strict"
import { runBookmarkSync } from "../../src/background/syncBookmarks.ts"
import type { KnowledgeCardDraftRecord } from "../../src/lib/types.ts"
import type { ExtensionSettings } from "../../src/lib/types.ts"

test("runBookmarkSync stores fetched bookmarks locally and returns sync stats", async () => {
  const recordedSummaries: Array<{ status: string; errorSummary?: string }> = []
  const recordedSyncRuns: Array<{ id: string; status: string; finishedAt?: string }> = []
  const recordedCardSyncs: Array<number> = []

  const result = await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async ({ fetchPage, limit }) => {
      assert.equal(limit, 1000)
      const page = await fetchPage({ cursor: undefined })
      return { bookmarks: page.bookmarks, failedCount: page.failedCount ?? 0 }
    },
    fetchBookmarksPage: async ({ cursor, requestContext }) => {
      assert.equal(cursor, undefined)
      assert.equal(requestContext.cookieHeader, "auth_token=abc; ct0=token123")
      assert.equal(requestContext.csrfToken, "token123")

      return {
        bookmarks: [
          {
            tweetId: "123",
            tweetUrl: "https://x.com/a/status/123",
            authorName: "Alice",
            authorHandle: "alice",
            text: "hello",
            createdAtOnX: "2026-03-15T00:00:00.000Z",
            savedAt: "2026-03-15T01:00:00.000Z",
            rawPayload: {}
          }
        ],
        nextCursor: null,
        failedCount: 0
      }
    },
    upsertBookmarks: async (bookmarks) => {
      assert.equal(bookmarks.length, 1)
      return { insertedCount: 1, updatedCount: 0 }
    },
    syncKnowledgeCards: async (sourceMaterials) => {
      recordedCardSyncs.push(sourceMaterials.length)
      return { createdCount: 1, updatedCount: 0 }
    },
    getSettings: async () => ({
      schemaVersion: 2,
      hasCompletedOnboarding: false,
      lastSyncSummary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      },
      aiGeneration: {
        enabled: true,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-5-mini"
      },
      exportScope: "all"
    }),
    createSyncRun: async (syncRun) => {
      recordedSyncRuns.push({
        id: syncRun.id,
        status: syncRun.status,
        finishedAt: syncRun.finishedAt
      })
    },
    updateSyncSummary: async (summary) => {
      recordedSummaries.push({ status: summary.status, errorSummary: summary.errorSummary })
    }
  })

  assert.equal(result.fetchedCount, 1)
  assert.equal(result.insertedCount, 1)
  assert.equal(result.updatedCount, 0)
  assert.equal(result.failedCount, 0)
  assert.deepEqual(recordedCardSyncs, [1])
  assert.deepEqual(
    recordedSummaries.map((summary) => summary.status),
    ["running", "success"]
  )
  assert.deepEqual(
    recordedSyncRuns.map((syncRun) => syncRun.status),
    ["running", "success"]
  )
  assert.equal(recordedSyncRuns[0]?.id, recordedSyncRuns[1]?.id)
  assert.equal(Boolean(recordedSyncRuns[0]?.finishedAt), false)
  assert.match(String(recordedSyncRuns[1]?.finishedAt), /^\d{4}-\d{2}-\d{2}T/)
})

test("runBookmarkSync default summary persistence updates saved settings", async () => {
  let savedSettings: ExtensionSettings = {
    schemaVersion: 1,
    hasCompletedOnboarding: false,
    lastSyncSummary: {
      status: "idle" as const,
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    aiGeneration: {
      enabled: false,
      provider: "openai",
      apiKey: "",
      model: "gpt-5-mini"
    },
    exportScope: "all"
  }

  await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async () => ({ bookmarks: [], failedCount: 0 }),
    upsertBookmarks: async () => ({ insertedCount: 0, updatedCount: 0 }),
    createSyncRun: async () => {},
    getSettings: async () => savedSettings,
    saveSettings: async (nextSettings) => {
      savedSettings = nextSettings
    }
  })

  assert.equal(savedSettings.lastSyncSummary.status, "success")
  assert.equal(savedSettings.lastSyncSummary.fetchedCount, 0)
})

test("runBookmarkSync passes ai settings into card generation when enabled", async () => {
  const capturedModels: string[] = []

  await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async () => ({
      bookmarks: [
        {
          tweetId: "123",
          tweetUrl: "https://x.com/a/status/123",
          authorName: "Alice",
          authorHandle: "alice",
          text: "hello",
          createdAtOnX: "2026-03-15T00:00:00.000Z",
          savedAt: "2026-03-15T01:00:00.000Z",
          rawPayload: {}
        }
      ],
      failedCount: 0
    }),
    upsertBookmarks: async () => ({ insertedCount: 1, updatedCount: 0 }),
    syncKnowledgeCards: async (sourceMaterials, options) => {
      const generated = await options?.generateDraft?.(sourceMaterials[0])
      capturedModels.push((generated as KnowledgeCardDraftRecord).quality.generatorVersion)
      return { createdCount: 1, updatedCount: 0 }
    },
    generateKnowledgeCardDraft: async ({ sourceMaterial, settings }) => ({
      id: `card-${sourceMaterial.tweetId}`,
      sourceMaterialId: sourceMaterial.tweetId,
      status: "draft",
      title: "AI card",
      theme: "AI card",
      summary: "AI card",
      keyExcerpt: "AI card",
      applicability: "AI card",
      provenance: [],
      quality: {
        score: 90,
        needsReview: false,
        warnings: [],
        generatorVersion: `openai:${settings.model}`
      },
      generatedAt: "2026-03-15T01:00:00.000Z",
      updatedAt: "2026-03-15T01:00:00.000Z",
      sourceFingerprint: "fingerprint",
      lastGeneratedFromModel: settings.model
    }),
    createSyncRun: async () => {},
    getSettings: async () => ({
      schemaVersion: 2,
      hasCompletedOnboarding: false,
      lastSyncSummary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      },
      aiGeneration: {
        enabled: true,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-5-mini"
      },
      exportScope: "all"
    }),
    saveSettings: async () => {}
  })

  assert.deepEqual(capturedModels, ["openai:gpt-5-mini"])
})

test("runBookmarkSync persists an error summary and rethrows when sync fails", async () => {
  const recordedSummaries: Array<{ status: string; errorSummary?: string }> = []
  const recordedSyncRuns: Array<{ id: string; status: string; errorSummary?: string; finishedAt?: string }> = []

  await assert.rejects(
    () =>
      runBookmarkSync({
        getXCookieHeader: async () => "auth_token=abc; ct0=token123",
        fetchBookmarksPage: async () => {
          throw new Error("X API error 401: unauthorized response body")
        },
        createSyncRun: async (syncRun) => {
          recordedSyncRuns.push({
            id: syncRun.id,
            status: syncRun.status,
            errorSummary: syncRun.errorSummary,
            finishedAt: syncRun.finishedAt
          })
        },
        updateSyncSummary: async (summary) => {
          recordedSummaries.push({ status: summary.status, errorSummary: summary.errorSummary })
        }
      }),
    /X API error 401: unauthorized response body/
  )

  assert.deepEqual(
    recordedSummaries.map((summary) => summary.status),
    ["running", "error"]
  )
  assert.equal(recordedSummaries[1].errorSummary, "X API error 401: unauthorized response body")
  assert.deepEqual(
    recordedSyncRuns.map((syncRun) => syncRun.status),
    ["running", "error"]
  )
  assert.equal(recordedSyncRuns[0]?.id, recordedSyncRuns[1]?.id)
  assert.equal(recordedSyncRuns[1]?.errorSummary, "X API error 401: unauthorized response body")
  assert.match(String(recordedSyncRuns[1]?.finishedAt), /^\d{4}-\d{2}-\d{2}T/)
})
