import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { ExtensionUiProvider, useExtensionUi } from "../../src/ui/provider.tsx"
import { installChromeRuntimeHarness } from "../helpers/runtime.ts"
import { cleanupRenders, render } from "./render.tsx"

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
  const { locale } = useExtensionUi()
  return <div data-testid="probe">{locale}</div>
}

test("cleanupRenders drains pending ExtensionUiProvider updates without act warnings", async () => {
  installChromeStorageMock()

  const originalConsoleError = console.error
  const consoleErrors: string[] = []
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(" "))
  }

  try {
    render(
      <ExtensionUiProvider>
        <Probe />
      </ExtensionUiProvider>
    )

    await cleanupRenders()

    assert.equal(
      consoleErrors.some((entry) => entry.includes("not wrapped in act")),
      false
    )
  } finally {
    console.error = originalConsoleError
    await cleanupRenders()
  }
})

test("cleanupRenders drains pending OptionsApp startup updates without act warnings", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const originalConsoleError = console.error
  const consoleErrors: string[] = []
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(" "))
  }

  try {
    render(<OptionsApp />)

    await cleanupRenders()

    assert.equal(
      consoleErrors.some((entry) => entry.includes("not wrapped in act")),
      false
    )
  } finally {
    console.error = originalConsoleError
    await cleanupRenders()
  }
})
