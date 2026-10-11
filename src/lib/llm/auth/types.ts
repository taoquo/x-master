// Credential abstraction. v1 only ever uses `apiKeyAuth` (see ./apiKeyAuth.ts);
// the OAuth interfaces exist so that adding a login flow later does not touch a
// single adapter, because adapters only ever consume `ResolvedAuth`.

import type { StoredLlmCredential } from "../../types.ts"

export type CredentialKind =
  | "api-key"
  | "api-key-or-none"
  | "azure-deployment"
  // Reserved. No provider declares these in v1 and there is no implementation.
  | "oauth-device"
  | "oauth-pkce"

// Defined in the shared type module so storage/ can normalise it without
// depending on the llm layer; re-exported here for the auth call sites.
export type { StoredLlmCredential } from "../../types.ts"

// The only three things a request can need. Anything that cannot be expressed as
// one of these is provider *config* (baseUrl defaults, Azure deployment names,
// model ids), not auth — which is why the Azure deployment name lives in settings
// rather than in the credential.
export interface ResolvedAuth {
  apiKey?: string
  headers?: Record<string, string>
  baseUrl?: string
}

export interface ApiKeyAuth {
  readonly kind: "api-key"
  // Answers "is this provider configured?". Every provider declares one of these,
  // including keyless local servers, so "not configured" is an explicit state
  // instead of an undefined check scattered across call sites.
  isConfigured(credential: StoredLlmCredential | undefined): boolean
  resolve(credential: StoredLlmCredential | undefined): ResolvedAuth
  save(apiKey: string): Promise<void>
  clear(): Promise<void>
}

// Reserved interface. `refresh` and `toAuth` are deliberately separate: the
// registry owns the locked refresh, `toAuth` only derives request auth from
// whatever ends up stored.
export interface OAuthAuth {
  readonly kind: "oauth-device" | "oauth-pkce"
  login(): Promise<StoredLlmCredential>
  refresh(credential: StoredLlmCredential): Promise<StoredLlmCredential>
  toAuth(credential: StoredLlmCredential): Promise<ResolvedAuth>
  logout(): Promise<void>
}

export interface ProviderAuth {
  apiKey?: ApiKeyAuth
  oauth?: OAuthAuth
}
