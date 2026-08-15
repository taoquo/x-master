import { useRef } from "react"
import type { OptionsCopy } from "../i18n/copy.ts"
import type { useWorkspaceData } from "./useWorkspaceData.ts"

// Export / restore / reset are reachable from both the sidebar footer icons and
// the settings panel, so the confirm + reload choreography lives here once.
export function useDataSafetyActions({
  workspace,
  copy
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  copy: OptionsCopy
}) {
  const restoreInputRef = useRef<HTMLInputElement | null>(null)

  function resetFileInput(input: HTMLInputElement | null) {
    if (input) {
      input.value = ""
    }
  }

  function reloadOptionsPage() {
    if (typeof location !== "undefined" && typeof location.reload === "function") {
      location.reload()
      return
    }

    if (typeof window !== "undefined" && typeof window.location?.reload === "function") {
      window.location.reload()
    }
  }

  function openRestorePicker() {
    restoreInputRef.current?.click()
  }

  async function handleRestoreFile(file: File | undefined, input: HTMLInputElement | null) {
    if (!file) {
      return
    }

    try {
      await workspace.handleValidateBackupFile(file)
      const shouldRestore = typeof window.confirm === "function" ? window.confirm(copy.restoreBackupConfirm) : true
      if (shouldRestore) {
        await workspace.handleRestoreBackupFile(file)
        reloadOptionsPage()
      }
    } catch {
      // The shared command error area renders the failure.
    } finally {
      resetFileInput(input)
    }
  }

  async function handleResetLocalData() {
    const shouldReset = typeof window.confirm === "function" ? window.confirm(copy.resetLocalDataConfirm) : true
    if (!shouldReset) {
      return
    }

    try {
      await workspace.handleResetLocalData()
      reloadOptionsPage()
    } catch {
      // The shared command error area renders the failure.
    }
  }

  return {
    restoreInputRef,
    openRestorePicker,
    handleRestoreFile,
    handleResetLocalData,
    isBusy: workspace.isExporting || workspace.isValidatingBackup || workspace.isRestoringBackup || workspace.isResettingData
  }
}
