import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { ExtensionUiProvider, useExtensionUi } from "../../src/ui/provider.tsx"
import { render, settle } from "../helpers/render.tsx"

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

function Probe() {
  const { locale, themePreference, resolvedTheme, t } = useExtensionUi()

  return (
    <div data-testid="probe" data-theme={resolvedTheme}>
      {locale}|{themePreference}|{t("popup.syncNow")}
    </div>
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
    classificationRules: []
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
