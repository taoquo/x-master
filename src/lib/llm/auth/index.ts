import { getSecrets } from "../../storage/secrets.ts"
import type { ExtensionSecrets } from "../../storage/secrets.ts"
import type { StoredLlmCredential } from "../../types.ts"
import { resolveProvider } from "../providers.ts"
import type { LlmProviderDefinition } from "../providers.ts"
import { createApiKeyAuth } from "./apiKeyAuth.ts"
import type { ApiKeyAuth, ProviderAuth, ResolvedAuth } from "./types.ts"

export type { CredentialKind, OAuthAuth, ProviderAuth, ResolvedAuth, StoredLlmCredential } from "./types.ts"

// v1 ships no OAuth implementation: no provider declares `oauth`, and there is no
// file that constructs one. The interface exists so that adding a login flow later
// touches only this module, because adapters consume `ResolvedAuth` and nothing
// else.
export function providerAuth(provider: LlmProviderDefinition): ProviderAuth {
  return {
    apiKey: createApiKeyAuth({
      providerId: provider.id,
      required: provider.credentialKind !== "api-key-or-none"
    })
  }
}

function credentialFor(
  secrets: ExtensionSecrets,
  providerId: string,
  allowLegacy: boolean
): StoredLlmCredential | undefined {
  const stored = secrets.llmProfiles?.[providerId]
  if (stored?.apiKey) {
    return stored
  }

  // Legacy installs stored exactly one key, belonging to whatever provider was
  // configured. Reading it here keeps that install working with no write
  // migration, and `allowLegacy` is only ever true for the active provider.
  if (allowLegacy && secrets.llmApiKey) {
    return { kind: "api-key", apiKey: secrets.llmApiKey }
  }

  return stored
}

export async function isProviderConfigured(
  providerId: string | undefined,
  secrets?: ExtensionSecrets
): Promise<boolean> {
  const provider = resolveProvider(providerId)
  const resolvedSecrets = secrets ?? (await getSecrets())
  const auth = providerAuth(provider).apiKey as ApiKeyAuth
  return auth.isConfigured(credentialFor(resolvedSecrets, provider.id, false))
}

// The single exit for credentials. Adapters and the orchestrator never read
// storage themselves, which is what keeps a future rotation/encryption change to
// one file — and what makes "is this provider configured?" answerable in one place.
export async function resolveAuth(
  providerId: string | undefined,
  options: { allowLegacy: boolean; secrets?: ExtensionSecrets } = { allowLegacy: false }
): Promise<ResolvedAuth | undefined> {
  const provider = resolveProvider(providerId)
  const secrets = options.secrets ?? (await getSecrets())
  const credential = credentialFor(secrets, provider.id, options.allowLegacy)
  const auth = providerAuth(provider).apiKey as ApiKeyAuth

  if (!auth.isConfigured(credential)) {
    return undefined
  }

  return auth.resolve(credential)
}

// Credentials are keyed by the exact provider id. Reading normalises an unknown id
// to the default provider (settings may come from a newer version), but writing an
// unknown id would silently store a credential under the wrong provider, so these
// two do not normalise.
export async function saveProviderApiKey(providerId: string, apiKey: string): Promise<void> {
  const auth = createApiKeyAuth({ providerId, required: true })
  await auth.save(apiKey)
}

export async function clearProviderApiKey(providerId: string): Promise<void> {
  const auth = createApiKeyAuth({ providerId, required: true })
  await auth.clear()
}
