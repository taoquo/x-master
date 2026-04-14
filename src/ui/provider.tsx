import React from "react"
import { createDefaultSettings, getSettings, saveSettings } from "../lib/storage/settings.ts"
import type { Locale, ThemePreference } from "../lib/types.ts"
import { translate, type MessageKey, type ResolvedTheme } from "./i18n.ts"

interface ExtensionUiValue {
  locale: Locale
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  t: (key: MessageKey) => string
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (themePreference: ThemePreference) => Promise<void>
}

const defaultSettings = createDefaultSettings()

const ExtensionUiContext = React.createContext<ExtensionUiValue | null>(null)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function resolveTheme(themePreference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  if (themePreference === "system") {
    return systemTheme
  }

  return themePreference
}

export function useExtensionUi() {
  const value = React.useContext(ExtensionUiContext)

  if (!value) {
    throw new Error("useExtensionUi must be used inside ExtensionUiProvider")
  }

  return value
}

export function ExtensionUiProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState(defaultSettings)
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(getSystemTheme)
  const settingsRef = React.useRef(settings)
  const clearThemeSwitchFrameRef = React.useRef<number | null>(null)

  const clearThemeSwitchingState = React.useCallback(() => {
    if (typeof document !== "undefined") {
      delete document.documentElement.dataset.themeSwitching
    }

    if (typeof window !== "undefined" && clearThemeSwitchFrameRef.current !== null) {
      window.cancelAnimationFrame(clearThemeSwitchFrameRef.current)
      clearThemeSwitchFrameRef.current = null
    }
  }, [])

  const startThemeSwitchingState = React.useCallback(() => {
    if (typeof document === "undefined") {
      return
    }

    clearThemeSwitchingState()
    document.documentElement.dataset.themeSwitching = "true"

    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      delete document.documentElement.dataset.themeSwitching
      return
    }

    clearThemeSwitchFrameRef.current = window.requestAnimationFrame(() => {
      clearThemeSwitchFrameRef.current = window.requestAnimationFrame(() => {
        delete document.documentElement.dataset.themeSwitching
        clearThemeSwitchFrameRef.current = null
      })
    })
  }, [clearThemeSwitchingState])

  React.useEffect(() => {
    void getSettings()
      .then((nextSettings) => {
        settingsRef.current = nextSettings
        setSettings(nextSettings)
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const listener = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light")
    }

    setSystemTheme(mediaQuery.matches ? "dark" : "light")

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener)
      return () => mediaQuery.removeEventListener("change", listener)
    }

    mediaQuery.addListener(listener)
    return () => mediaQuery.removeListener(listener)
  }, [])

  const resolvedTheme = resolveTheme(settings.themePreference, systemTheme)

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    document.documentElement.lang = settings.locale
  }, [settings.locale])

  React.useEffect(() => () => clearThemeSwitchingState(), [clearThemeSwitchingState])

  const persistSettings = React.useCallback(async (nextSettings: typeof settings) => {
    settingsRef.current = nextSettings
    setSettings(nextSettings)
    await saveSettings(nextSettings)
  }, [])

  const value = React.useMemo<ExtensionUiValue>(
    () => ({
      locale: settings.locale,
      themePreference: settings.themePreference,
      resolvedTheme,
      t: (key) => translate(settings.locale, key),
      setLocale: async (locale) => {
        await persistSettings({
          ...settingsRef.current,
          locale
        })
      },
      setThemePreference: async (themePreference) => {
        startThemeSwitchingState()

        await persistSettings({
          ...settingsRef.current,
          themePreference
        })
      }
    }),
    [persistSettings, resolvedTheme, settings.locale, settings.themePreference, startThemeSwitchingState]
  )

  return <ExtensionUiContext.Provider value={value}>{children}</ExtensionUiContext.Provider>
}
