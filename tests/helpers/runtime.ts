import { createBackgroundMessageHandler } from "../../src/background/index.ts"
import { resetLocalData } from "../../src/lib/storage/resetLocalData.ts"
import { loadWorkspaceDataFromLocal } from "../../src/lib/workspace/loadWorkspaceData.ts"

export function installChromeRuntimeHarness({
  runSync
}: {
  runSync?: () => Promise<{ fetchedCount: number; insertedCount: number; updatedCount: number; failedCount: number }>
} = {}) {
  let storedSettings: unknown
  let openOptionsPageCallCount = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => loadWorkspaceDataFromLocal(),
    resetData: async () => {
      await resetLocalData()
      return { success: true }
    },
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
        get: async () => ({ settings: storedSettings }),
        set: async (value: Record<string, unknown>) => {
          storedSettings = value.settings
        }
      }
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
    getStoredSettings: () => storedSettings
  }
}
