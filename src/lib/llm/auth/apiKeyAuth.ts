import { modifySecrets } from "../../storage/secrets.ts"
import type { ApiKeyAuth } from "./types.ts"

// The only ApiKeyAuth implementation. `required: false` models a keyless local
// server: it is configured the moment the endpoint is, which keeps "not
// configured" a real state instead of "no key" being treated as a failure.
export function createApiKeyAuth(options: { providerId: string; required: boolean }): ApiKeyAuth {
  const { providerId, required } = options

  return {
    kind: "api-key",

    isConfigured(credential) {
      if (!required) {
        return true
      }

      return Boolean(credential?.apiKey)
    },

    resolve(credential) {
      return { apiKey: credential?.apiKey }
    },

    async save(apiKey) {
      const trimmed = apiKey.trim()
      await modifySecrets((current) => ({
        ...current,
        llmProfiles: {
          ...current.llmProfiles,
          [providerId]: { ...current.llmProfiles?.[providerId], kind: "api-key", apiKey: trimmed }
        }
      }))
    },

    async clear() {
      await modifySecrets((current) => {
        const next = { ...current.llmProfiles }
        delete next[providerId]
        return { ...current, llmProfiles: next }
      })
    }
  }
}
