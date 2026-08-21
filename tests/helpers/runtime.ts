import { createBackgroundMessageHandler } from "../../src/background/index.ts"
import { resetLocalData } from "../../src/lib/storage/resetLocalData.ts"
import { loadWorkspaceDataFromLocal } from "../../src/lib/workspace/loadWorkspaceData.ts"

type StorageListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void

export function installChromeRuntimeHarness({
  runSync,
  runAutoTag,
  cancelAutoTag,
  testLlmConnection,
  reviewTagVocabulary
}: {
  runSync?: () => Promise<{ fetchedCount: number; insertedCount: number; updatedCount: number; failedCount: number }>
  runAutoTag?: () => Promise<unknown>
  cancelAutoTag?: () => Promise<boolean>
  testLlmConnection?: () => Promise<{ ok: boolean; error?: string }>
  reviewTagVocabulary?: () => Promise<{
    ok: boolean
    error?: string
    merges: Array<{ targetTagId: string; targetName: string; sourceTagIds: string[]; sourceNames: string[]; reason?: string }>
    renames: Array<{ tagId: string; from: string; to: string; reason?: string }>
  }>
} = {}) {
  let stored: Record<string, unknown> = {}
  const storageListeners = new Set<StorageListener>()
  let openOptionsPageCallCount = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => loadWorkspaceDataFromLocal(),
    resetData: async () => {
      await resetLocalData()
      return { success: true }
    },
    ...(testLlmConnection ? { testLlmConnection } : {}),
    ...(reviewTagVocabulary ? { reviewTagVocabulary } : {}),
    ...(runAutoTag ? { runAutoTag } : {}),
    ...(cancelAutoTag ? { cancelAutoTag } : {}),
    runSync:
      runSync ??
      (async () => ({
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      }))
  })

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      sendMessage: async (message: { type: string }) => handler(message),
      openOptionsPage: async () => {
        openOptionsPageCallCount += 1
      },
      getURL: (path: string) => `chrome-extension://extension-id/${path}`
    },
    storage: {
      local: {
        get: async (key?: string) => (key ? { [key]: stored[key] } : { ...stored }),
        set: async (value: Record<string, unknown>) => {
          stored = { ...stored, ...value }
          const changes = Object.fromEntries(Object.keys(value).map((key) => [key, { newValue: value[key] }]))
          for (const listener of storageListeners) {
            listener(changes, "local")
          }
        }
      },
      onChanged: {
        addListener: (listener: StorageListener) => {
          storageListeners.add(listener)
        },
        removeListener: (listener: StorageListener) => {
          storageListeners.delete(listener)
        }
      }
    },
    permissions: {
      request: async () => true,
      contains: async () => true
    },
    tabs: {
      query: async () => [],
      update: async () => {},
      create: async () => {}
    },
    windows: {
      update: async () => {}
    }
  }

  return {
    getOpenOptionsPageCallCount: () => openOptionsPageCallCount,
    getStoredSettings: () => stored.settings,
    getStoredSecrets: () => stored.secrets as { llmApiKey?: string } | undefined
  }
}
