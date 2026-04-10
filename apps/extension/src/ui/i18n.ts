import type { Locale, ThemePreference } from "../lib/types.ts"

export type ResolvedTheme = "light" | "dark"

export const localeOptions: Array<{ value: Locale; label: Record<Locale, string> }> = [
  {
    value: "zh-CN",
    label: {
      "zh-CN": "中文",
      en: "Chinese"
    }
  },
  {
    value: "en",
    label: {
      "zh-CN": "英文",
      en: "English"
    }
  }
]

export const themeOptions: Array<{ value: ThemePreference; label: Record<Locale, string> }> = [
  {
    value: "system",
    label: {
      "zh-CN": "跟随系统",
      en: "System"
    }
  },
  {
    value: "light",
    label: {
      "zh-CN": "浅色",
      en: "Light"
    }
  },
  {
    value: "dark",
    label: {
      "zh-CN": "深色",
      en: "Dark"
    }
  }
]

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
