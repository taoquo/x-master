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
