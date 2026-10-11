const SECRETS_STORAGE_KEY = "secrets"

export interface ExtensionSecrets {
  llmApiKey?: string
}

function normalizeSecrets(value: unknown): ExtensionSecrets {
  const record = (value ?? {}) as Partial<ExtensionSecrets>
  const llmApiKey = typeof record.llmApiKey === "string" ? record.llmApiKey.trim() : ""

  return llmApiKey ? { llmApiKey } : {}
}

export async function getSecrets(): Promise<ExtensionSecrets> {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.get) {
    return {}
  }

  const stored = (await chrome.storage.local.get(SECRETS_STORAGE_KEY))[SECRETS_STORAGE_KEY]
  return normalizeSecrets(stored)
}

export async function saveSecrets(secrets: ExtensionSecrets) {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.set) {
    return
  }

  await chrome.storage.local.set({
    [SECRETS_STORAGE_KEY]: normalizeSecrets(secrets)
  })
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
