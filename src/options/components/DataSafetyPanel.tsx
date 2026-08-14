import type { Locale } from "../../lib/types.ts"
import type { OptionsCopy } from "../i18n/copy.ts"
import type { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import { InlineMessage } from "./common.tsx"

export function formatBackupDate(value: string, locale: Locale) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date)
}

export function DataSafetyPanel({
  workspace,
  locale,
  copy
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  locale: Locale
  copy: OptionsCopy
}) {
  const validation = workspace.backupValidationResult
  const restoreResult = workspace.restoreResult
  const resetResult = workspace.resetResult

  const statusText = (() => {
    if (restoreResult) {
      return `${copy.restoredBackup} ${restoreResult.counts.bookmarks} ${copy.bookmarksCountLabel}`
    }

    if (resetResult) {
      return copy.localDataReset
    }

    if (validation) {
      return `${copy.validBackup} · ${validation.counts.bookmarks} ${copy.bookmarksCountLabel} · ${validation.counts.tags} ${copy.tagsCountLabel} · ${formatBackupDate(validation.exportedAt, locale)}`
    }

    return null
  })()

  if (!statusText) {
    return null
  }

  return (
    <section data-testid="workspace-data-safety-panel" className="options-data-safety-panel">
      <div data-testid="data-safety-validation-result">
        <InlineMessage
          message={statusText}
          tone="info"
          className="options-data-safety-result"
        />
      </div>
    </section>
  )
}
