import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { act } from "react"
import { ExtensionUiProvider, useExtensionUi } from "../../src/ui/provider.tsx"
import { render, settle } from "../helpers/render.tsx"
import { getSettings } from "../../src/lib/storage/settings.ts"

function installChromeStorageMock(storedValue?: unknown) {
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedValue }),
        set: async () => {}
      }
    }
  }
}

function installWritableChromeStorageMock(storedValue?: unknown) {
  let stored = storedValue

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: stored }),
        set: async (value: Record<string, unknown>) => {
          stored = value.settings
        }
      }
    }
  }
}

function Probe() {
  const { locale, themePreference, resolvedTheme, t } = useExtensionUi()

  return (
    <div data-testid="probe" data-theme={resolvedTheme}>
      {locale}|{themePreference}|{t("popup.syncNow")}
    </div>
  )
}

function LocaleSwitcher() {
  const { setLocale } = useExtensionUi()

  return (
    <button type="button" data-testid="switch-locale" onClick={() => void setLocale("zh-CN")}>
      switch
    </button>
  )
}

test("ExtensionUiProvider exposes default locale, theme preference, and translated copy", async () => {
  installChromeStorageMock()

  const { container } = render(
    <ExtensionUiProvider>
      <Probe />
    </ExtensionUiProvider>
  )

  await settle()

  const probe = container.querySelector('[data-testid="probe"]')
  assert.ok(probe)
  assert.equal(probe.getAttribute("data-theme"), "light")
  assert.match(probe.textContent ?? "", /en\|system\|Sync now/)
})

test("ExtensionUiProvider resolves stored english locale and dark theme", async () => {
  installChromeStorageMock({
    schemaVersion: 3,
    locale: "en",
    themePreference: "dark",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
  })

  const { container } = render(
    <ExtensionUiProvider>
      <Probe />
    </ExtensionUiProvider>
  )

  await settle()

  const probe = container.querySelector('[data-testid="probe"]')
  assert.ok(probe)
  assert.equal(probe.getAttribute("data-theme"), "dark")
  assert.match(probe.textContent ?? "", /en\|dark\|Sync now/)
})

test("ExtensionUiProvider writes only the changed field so other settings survive", async () => {
  installWritableChromeStorageMock({
    schemaVersion: 6,
    locale: "en",
    themePreference: "system",
    autoTag: {
      enabled: true,
      runAfterSync: true,
      heuristics: { useHashtags: true, useAuthors: true, keywordRules: [] },
      llm: {
        enabled: true,
        provider: "openai-compatible",
        baseUrl: "https://api.appintheloop.com/v1",
        model: "claude-sonnet-5",
        batchSize: 10,
        maxBookmarksPerRun: 200,
        tagVocabularyMode: "open"
      }
    }
  })

  const { container, dom } = render(
    <ExtensionUiProvider>
      <Probe />
      <LocaleSwitcher />
    </ExtensionUiProvider>
  )

  await settle()

  const button = container.querySelector('[data-testid="switch-locale"]')
  assert.ok(button)

  await act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const stored = await getSettings()
  assert.equal(stored.locale, "zh-CN")
  assert.equal(stored.autoTag.llm.baseUrl, "https://api.appintheloop.com/v1")
  assert.equal(stored.autoTag.llm.model, "claude-sonnet-5")
  assert.equal(stored.autoTag.llm.enabled, true)
})
