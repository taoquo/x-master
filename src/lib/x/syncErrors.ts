export const SYNC_ERROR_KINDS = [
  "auth_expired",
  "rate_limited",
  "network_error",
  "x_schema_changed",
  "unknown"
] as const

export type SyncErrorKind = (typeof SYNC_ERROR_KINDS)[number]

export class XApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`X API error ${status}`)
    this.name = "XApiError"
    this.status = status
  }
}

export class XSchemaChangedError extends Error {
  constructor() {
    super("X bookmark timeline structure changed")
    this.name = "XSchemaChangedError"
  }
}

export function isSyncErrorKind(value: unknown): value is SyncErrorKind {
  return typeof value === "string" && (SYNC_ERROR_KINDS as readonly string[]).includes(value)
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : ""
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isAbortError(error: unknown) {
  return getErrorName(error) === "AbortError"
}

function isNetworkError(error: unknown) {
  const message = getErrorMessage(error)
  return (
    error instanceof TypeError ||
    isAbortError(error) ||
    /failed to fetch/i.test(message) ||
    /networkerror/i.test(message) ||
    /network error/i.test(message)
  )
}

export function getSyncErrorSummary(kind: SyncErrorKind, locale: "zh-CN" | "en" = "zh-CN") {
  const summaries = {
    "zh-CN": {
      auth_expired: "X 登录已失效，请重新登录 X 后再同步。",
      rate_limited: "X 暂时限制了同步请求，请稍后再试。",
      network_error: "网络请求失败，请检查网络连接后重试。",
      x_schema_changed: "X 页面或 API 结构已变化，请更新扩展后再同步。",
      unknown: "同步失败，请重试。"
    },
    en: {
      auth_expired: "X login expired. Sign in to X again, then sync.",
      rate_limited: "X is rate limiting sync requests. Try again later.",
      network_error: "Network request failed. Check your connection, then retry.",
      x_schema_changed: "X page or API structure changed. Update the extension, then sync.",
      unknown: "Sync failed. Please retry."
    }
  }

  return summaries[locale][kind]
}

export function normalizeSyncError(error: unknown): { kind: SyncErrorKind; summary: string } {
  const message = getErrorMessage(error)

  if (
    error instanceof XApiError ||
    /X API error\s+(401|403|429)\b/i.test(message)
  ) {
    const status = error instanceof XApiError
      ? error.status
      : Number(message.match(/X API error\s+(\d+)/i)?.[1])

    if (status === 401 || status === 403) {
      return {
        kind: "auth_expired",
        summary: getSyncErrorSummary("auth_expired")
      }
    }

    if (status === 429) {
      return {
        kind: "rate_limited",
        summary: getSyncErrorSummary("rate_limited")
      }
    }
  }

  if (/missing ct0 cookie/i.test(message) || /no x cookies found/i.test(message)) {
    return {
      kind: "auth_expired",
      summary: getSyncErrorSummary("auth_expired")
    }
  }

  if (error instanceof XSchemaChangedError || /bookmark timeline structure changed/i.test(message)) {
    return {
      kind: "x_schema_changed",
      summary: getSyncErrorSummary("x_schema_changed")
    }
  }

  if (isNetworkError(error)) {
    return {
      kind: "network_error",
      summary: getSyncErrorSummary("network_error")
    }
  }

  return {
    kind: "unknown",
    summary: getSyncErrorSummary("unknown")
  }
}
