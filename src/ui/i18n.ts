import type { Locale } from "../lib/types.ts"

export type ResolvedTheme = "light" | "dark"

export const messages = {
  "popup.syncNow": {
    "zh-CN": "立即同步",
    en: "Sync now"
  }
} as const

export type MessageKey = keyof typeof messages

export function translate(locale: Locale, key: MessageKey) {
  return messages[key][locale]
}
