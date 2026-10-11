import test from "node:test"
import assert from "node:assert/strict"
import { getSecrets, restrictStorageToTrustedContexts, saveSecrets } from "../../src/lib/storage/secrets.ts"

function installChromeStorageMock() {
  let stored: Record<string, unknown> = {}

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: stored[key] }),
        set: async (value: Record<string, unknown>) => {
          stored = { ...stored, ...value }
        }
      }
    }
  }

  return { getStored: () => stored }
}

test("getSecrets returns empty object when nothing is stored", async () => {
  installChromeStorageMock()
  assert.deepEqual(await getSecrets(), {})
})

test("saveSecrets trims the api key and drops empty values", async () => {
  const storage = installChromeStorageMock()

  await saveSecrets({ llmApiKey: "  sk-test-123  " })
  assert.deepEqual(await getSecrets(), { llmApiKey: "sk-test-123" })

  await saveSecrets({ llmApiKey: "   " })
  assert.deepEqual(await getSecrets(), {})
  assert.deepEqual(storage.getStored().secrets, {})
})

test("secrets are stored under a dedicated key, separate from settings", async () => {
  const storage = installChromeStorageMock()

  await saveSecrets({ llmApiKey: "sk-separate" })
  assert.equal("settings" in storage.getStored(), false)
  assert.equal((storage.getStored().secrets as { llmApiKey?: string }).llmApiKey, "sk-separate")
})

test("the worker restricts the secrets area to trusted contexts", async () => {
  const levels: unknown[] = []
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
        setAccessLevel: async (options: unknown) => {
          levels.push(options)
        }
      }
    }
  }

  await restrictStorageToTrustedContexts()

  // The default level lets the content script beside x.com read this area, and the
  // API key lives here. Trusted contexts are the extension's own pages and worker.
  assert.deepEqual(levels, [{ accessLevel: "TRUSTED_CONTEXTS" }])
})

test("restricting the area is a no-op on Chrome without the API", async () => {
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: { local: { get: async () => ({}), set: async () => {} } }
  }

  // Older Chrome predates setAccessLevel; the call must not break worker startup.
  await restrictStorageToTrustedContexts()

  // And a missing chrome global altogether (node tests, non-extension contexts).
  delete (globalThis as { chrome?: unknown }).chrome
  await restrictStorageToTrustedContexts()
})
