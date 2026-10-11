import { createBackgroundMessageHandler } from "../../src/background/index.ts"
import { resetLocalData } from "../../src/lib/storage/resetLocalData.ts"
import { loadWorkspaceDataFromLocal } from "../../src/lib/workspace/loadWorkspaceData.ts"

type StorageListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void
type RuntimeMessageListener = (message: unknown) => void

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
  // Progress broadcasts are push-only, so a test has to be able to emit one the
  // way the background worker would.
  const runtimeMessageListeners = new Set<RuntimeMessageListener>()
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
      getURL: (path: string) => `chrome-extension://extension-id/${path}`,
      onMessage: {
        addListener: (listener: RuntimeMessageListener) => {
          runtimeMessageListeners.add(listener)
        },
        removeListener: (listener: RuntimeMessageListener) => {
          runtimeMessageListeners.delete(listener)
        }
      }
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
    emitRuntimeMessage: (message: unknown) => {
      for (const listener of runtimeMessageListeners) {
        listener(message)
      }
    },
    getStoredSettings: () => stored.settings,
    getStoredSecrets: () =>
      stored.secrets as
        | { llmApiKey?: string; llmProfiles?: Record<string, { apiKey?: string }> }
        | undefined,
    // Credentials are stored per provider now; the legacy single field is only
    // read, never written.
    getStoredProviderApiKey: (providerId: string) =>
      (stored.secrets as { llmProfiles?: Record<string, { apiKey?: string }> } | undefined)?.llmProfiles?.[
        providerId
      ]?.apiKey
  }
}
