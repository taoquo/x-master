import test from "node:test"
import assert from "node:assert/strict"
import { getSecrets, saveSecrets } from "../../src/lib/storage/secrets.ts"

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
