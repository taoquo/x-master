import type { StoredLlmCredential } from "../types.ts"

const SECRETS_STORAGE_KEY = "secrets"

export interface ExtensionSecrets {
  // Every provider's credential lives under this one key: a second storage key
  // would widen the window in which two concurrent writers lose an update.
  llmProfiles?: Record<string, StoredLlmCredential>
  // Legacy single-provider field. Read-only, kept so an existing install keeps
  // working without a write migration (see resolveAuth).
  llmApiKey?: string
}

function normalizeCredential(value: unknown): StoredLlmCredential | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const record = value as Record<string, unknown>
  const credential: StoredLlmCredential = {}
  const kind = record.kind
  if (kind === "api-key" || kind === "oauth") {
    credential.kind = kind
  }

  const apiKey = typeof record.apiKey === "string" ? record.apiKey.trim() : ""
  if (apiKey) {
    credential.apiKey = apiKey
  }

  for (const field of ["accessToken", "refreshToken", "accountLabel"] as const) {
    const raw = record[field]
    if (typeof raw === "string" && raw.trim()) {
      credential[field] = raw.trim()
    }
  }

  if (typeof record.expiresAt === "number" && Number.isFinite(record.expiresAt)) {
    credential.expiresAt = record.expiresAt
  }

  return Object.keys(credential).length ? credential : undefined
}

function normalizeSecrets(value: unknown): ExtensionSecrets {
  const record = (value ?? {}) as Partial<ExtensionSecrets>
  const llmApiKey = typeof record.llmApiKey === "string" ? record.llmApiKey.trim() : ""

  const profiles: Record<string, StoredLlmCredential> = {}
  const rawProfiles = record.llmProfiles
  if (rawProfiles && typeof rawProfiles === "object") {
    for (const [providerId, raw] of Object.entries(rawProfiles as Record<string, unknown>)) {
      const credential = normalizeCredential(raw)
      if (providerId && credential) {
        profiles[providerId] = credential
      }
    }
  }

  const next: ExtensionSecrets = {}
  if (Object.keys(profiles).length) {
    next.llmProfiles = profiles
  }
  if (llmApiKey) {
    next.llmApiKey = llmApiKey
  }

  return next
}

export async function getSecrets(): Promise<ExtensionSecrets> {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.get) {
    return {}
  }

  const stored = (await chrome.storage.local.get(SECRETS_STORAGE_KEY))[SECRETS_STORAGE_KEY]
  return normalizeSecrets(stored)
}

async function writeSecrets(secrets: ExtensionSecrets) {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.set) {
    return
  }

  await chrome.storage.local.set({
    [SECRETS_STORAGE_KEY]: normalizeSecrets(secrets)
  })
}

// chrome.storage has no transactions, and the options page and the popup can both
// write while the worker is running. Every write therefore goes through one
// serialised read-modify-write chain, so two concurrent saves cannot lose each
// other's update.
let secretsWriteChain: Promise<unknown> = Promise.resolve()

export async function modifySecrets(
  mutate: (current: ExtensionSecrets) => ExtensionSecrets | Promise<ExtensionSecrets>
): Promise<ExtensionSecrets> {
  const run = secretsWriteChain.then(async () => {
    const current = await getSecrets()
    const next = normalizeSecrets(await mutate(current))
    await writeSecrets(next)
    return next
  })

  // Keep the chain alive after a failure, but let the caller see the rejection.
  secretsWriteChain = run.catch(() => {})

  return run
}

export async function saveSecrets(secrets: ExtensionSecrets) {
  await modifySecrets(() => secrets)
}

// chrome.storage.local defaults to TRUSTED_AND_UNTRUSTED_CONTEXTS, which means the
// content script running next to x.com can read this area — and this area holds the
// LLM API key. Nothing under src/content/ uses chrome.storage (it only uses
// chrome.runtime), so restricting the area to trusted contexts costs nothing and
// keeps the key unreachable from any code that shares a page with a web page.
//
// Only a trusted context (an extension page or the service worker) may call this,
// so the worker entry point calls it. Older Chrome predates the API.
export async function restrictStorageToTrustedContexts() {
  const storageLocal = typeof chrome === "undefined" ? undefined : chrome.storage?.local
  if (!storageLocal?.setAccessLevel) {
    return
  }

  try {
    await storageLocal.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  } catch {
    // Not permitted in this context, or unsupported: the default level stands.
  }
}
