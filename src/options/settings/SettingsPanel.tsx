import React, { useEffect, useRef, useState } from "react"
import type { AutoTagRunSummary, ExtensionSettings, KeywordTagRule, Locale, ThemePreference } from "../../lib/types.ts"
import { SETTINGS_STORAGE_KEY, getSettings, updateSettings } from "../../lib/storage/settings.ts"
import { getSecrets, saveSecrets } from "../../lib/storage/secrets.ts"
import { clearBlockedTagKeys } from "../../lib/tags/tagActions.ts"
import { AUTOTAG_RUN_MESSAGE, LLM_TEST_CONNECTION_MESSAGE } from "../../lib/runtime/messages.ts"
import { subscribeAutoTagProgress, type AutoTagProgress } from "../../lib/runtime/autotagProgress.ts"
import { AppIcon } from "../../ui/icons.tsx"
import type { OptionsCopy } from "../i18n/copy.ts"
import type { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import type { useDataSafetyActions } from "../hooks/useDataSafetyActions.ts"
import { InlineMessage } from "../components/common.tsx"
import { cn, formatTimestamp } from "../utils.ts"

type SettingsSection = "general" | "sync" | "autotag" | "data-safety"

const SETTINGS_SECTIONS: SettingsSection[] = ["general", "sync", "autotag", "data-safety"]
const AUTOTAG_POLL_INTERVAL_MS = 1500
const AUTOTAG_POLL_ATTEMPTS = 120

function SettingsToggleRow({
  testId,
  label,
  hint,
  checked,
  onChange
}: {
  testId: string
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label data-testid={testId} className="options-filter-row options-settings-toggle-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint ? <span className="options-meta-copy block">{hint}</span> : null}
      </span>
    </label>
  )
}

function describeAutoTagOutcome(summary: AutoTagRunSummary, copy: OptionsCopy): string {
  if (summary.outcome === "no-candidates") return copy.settingsAutoTagResultNoCandidates
  if (summary.outcome === "empty-vocabulary") return copy.settingsAutoTagResultEmptyVocabulary
  if (summary.outcome === "all-blocked") return copy.settingsAutoTagResultAllBlocked
  if (summary.outcome === "budget-exhausted") return copy.settingsAutoTagResultBudgetExhausted
  if (summary.outcome === "llm-disabled") return copy.settingsAutoTagResultLlmDisabled
  if (summary.outcome === "missing-api-key") return copy.settingsAutoTagResultMissingKey
  if (summary.outcome === "failed") {
    return summary.error ? `${copy.settingsAutoTagResultFailed}: ${summary.error}` : copy.settingsAutoTagResultFailed
  }
  return copy.settingsAutoTagResultOk
    .replace("{suggested}", String(summary.suggestedCount))
    .replace("{pending}", String(summary.pendingCount))
}

function describeAutoTagDetail(summary: AutoTagRunSummary, copy: OptionsCopy): string {
  return copy.settingsAutoTagResultDetail
    .replace("{candidate}", String(summary.candidateCount))
    .replace("{processed}", String(summary.llmProcessedCount))
    .replace("{batches}", String(summary.llmBatchCount))
    .replace("{failed}", String(summary.llmFailedBatchCount))
    .replace("{vocabulary}", String(summary.vocabularySize))
    .replace("{budget}", summary.newTagBudget < 0 ? "∞" : String(summary.newTagBudget))
}

export function SettingsPanel({
  workspace,
  copy,
  locale,
  themePreference,
  setLocale,
  setThemePreference,
  dataSafety,
  onClose
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  copy: OptionsCopy
  locale: Locale
  themePreference: ThemePreference
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (themePreference: ThemePreference) => Promise<void>
  dataSafety: ReturnType<typeof useDataSafetyActions>
  onClose: () => void
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general")
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [autoTagRunMessage, setAutoTagRunMessage] = useState<string | null>(null)
  const [autoTagProgress, setAutoTagProgress] = useState<AutoTagProgress | null>(null)
  const [autoTagRunSummary, setAutoTagRunSummary] = useState<AutoTagRunSummary | null>(null)
  const [isAutoTagRunning, setIsAutoTagRunning] = useState(false)
  const [draftKeyword, setDraftKeyword] = useState("")
  const [draftTagName, setDraftTagName] = useState("")
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false)
  const [draftApiKey, setDraftApiKey] = useState("")
  const [llmTestState, setLlmTestState] = useState<{ status: "idle" | "testing" | "ok" | "error"; error?: string }>({
    status: "idle"
  })
  const pollAbortRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    void getSettings()
      .then((loaded) => {
        if (!cancelled) {
          setSettings(loaded)
          setAutoTagRunSummary(loaded.lastAutoTagRun ?? null)
        }
      })
      .catch(() => {})

    void getSecrets()
      .then((secrets) => {
        if (!cancelled) {
          setHasStoredApiKey(Boolean(secrets.llmApiKey))
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  // The run happens in the background worker, so the panel listens for progress
  // broadcasts instead of holding the message channel open.
  useEffect(() => subscribeAutoTagProgress(setAutoTagProgress), [])

  // The background worker owns the run summary, and a run can also be started
  // by a sync instead of by this panel. Mirroring storage changes keeps the
  // result block from showing a stale failure long after a later run succeeded.
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged?.addListener) {
      return
    }

    const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== "local" || !changes[SETTINGS_STORAGE_KEY]) {
        return
      }

      void getSettings()
        .then((loaded) => {
          setSettings(loaded)
          setAutoTagRunSummary(loaded.lastAutoTagRun ?? null)
        })
        .catch(() => {})
    }

    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  useEffect(
    () => () => {
      pollAbortRef.current = true
    },
    []
  )

  // Field-level patch write: the panel holds a snapshot loaded on mount, so a
  // full overwrite here would revert whatever other surfaces changed since.
  function persistSettings(patch: Partial<ExtensionSettings>) {
    setSettings((current) => (current ? { ...current, ...patch } : current))
    void updateSettings(patch)
  }

  function updateAutoTag(patch: Partial<ExtensionSettings["autoTag"]>) {
    if (!settings) {
      return
    }

    persistSettings({ autoTag: { ...settings.autoTag, ...patch } })
  }

  function updateHeuristics(patch: Partial<ExtensionSettings["autoTag"]["heuristics"]>) {
    if (!settings) {
      return
    }

    updateAutoTag({ heuristics: { ...settings.autoTag.heuristics, ...patch } })
  }

  // Bulk tag deletions can block hundreds of mainstream names, which silently
  // starves every later run. This is the only way back out of that state.
  async function clearBlockedTags() {
    await clearBlockedTagKeys()
    setSettings((current) =>
      current ? { ...current, autoTag: { ...current.autoTag, blockedTagKeys: [] } } : current
    )
    setAutoTagRunMessage(copy.settingsClearBlockedTagsDone)
  }

  function updateLlm(patch: Partial<ExtensionSettings["autoTag"]["llm"]>) {
    if (!settings) {
      return
    }

    updateAutoTag({ llm: { ...settings.autoTag.llm, ...patch } })
  }

  // The LLM endpoint lives outside the default x.com host permission, so we
  // request the origin on demand when the user turns the feature on.
  async function ensureHostPermission(baseUrl: string): Promise<boolean> {
    if (typeof chrome === "undefined" || !chrome.permissions?.request) {
      return true
    }

    try {
      const origin = new URL(baseUrl).origin
      return await chrome.permissions.request({ origins: [origin + "/*"] })
    } catch {
      return false
    }
  }

  async function handleLlmEnabledChange(checked: boolean) {
    if (!settings) {
      return
    }

    if (!checked) {
      updateLlm({ enabled: false })
      return
    }

    const granted = await ensureHostPermission(settings.autoTag.llm.baseUrl)
    if (!granted) {
      setLlmTestState({ status: "error", error: copy.settingsLlmPermissionDenied })
      return
    }

    setLlmTestState({ status: "idle" })
    updateLlm({ enabled: true })
  }

  // Writes the draft key to extension storage. The background worker reads the
  // key from storage, so an unsaved draft is invisible to it.
  async function persistDraftApiKey(apiKey: string) {
    await saveSecrets({ llmApiKey: apiKey })
    setHasStoredApiKey(true)
    setDraftApiKey("")
  }

  async function clearStoredApiKey() {
    await saveSecrets({})
    setHasStoredApiKey(false)
    setDraftApiKey("")
    setLlmTestState({ status: "idle" })
  }

  async function testLlmConnection() {
    if (!settings || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      return
    }

    const draft = draftApiKey.trim()
    if (!draft && !hasStoredApiKey) {
      setLlmTestState({ status: "error", error: copy.settingsLlmTestMissingKey })
      return
    }

    // chrome.permissions.request only works inside a user gesture, so it has to
    // be the first await in this click handler.
    const granted = await ensureHostPermission(settings.autoTag.llm.baseUrl)
    if (!granted) {
      setLlmTestState({ status: "error", error: copy.settingsLlmPermissionDenied })
      return
    }

    if (draft) {
      await persistDraftApiKey(draft)
    }

    setLlmTestState({ status: "testing" })
    const result = (await chrome.runtime.sendMessage({ type: LLM_TEST_CONNECTION_MESSAGE })) as
      | { ok: boolean; error?: string }
      | undefined

    if (result?.ok) {
      setLlmTestState({ status: "ok" })
    } else {
      setLlmTestState({
        status: "error",
        error: result?.error === "missing-api-key" ? copy.settingsLlmTestMissingKey : result?.error
      })
    }
  }

  function addKeywordRule() {
    const keyword = draftKeyword.trim()
    const tagName = draftTagName.trim()
    if (!settings || !keyword || !tagName) {
      return
    }

    const nextRules: KeywordTagRule[] = [...settings.autoTag.heuristics.keywordRules, { keyword, tagName }]
    updateHeuristics({ keywordRules: nextRules })
    setDraftKeyword("")
    setDraftTagName("")
  }

  function removeKeywordRule(index: number) {
    if (!settings) {
      return
    }

    const nextRules = settings.autoTag.heuristics.keywordRules.filter((_, ruleIndex) => ruleIndex !== index)
    updateHeuristics({ keywordRules: nextRules })
  }

  // The background worker answers the trigger immediately and finishes the run
  // asynchronously, so the panel polls the persisted summary until finishedAt
  // moves. Without this the button gave no feedback at all.
  async function runAutoTagNow() {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      return
    }

    if (isAutoTagRunning) {
      return
    }

    const previousFinishedAt = autoTagRunSummary?.finishedAt ?? ""
    setAutoTagRunMessage(copy.settingsAutoTagRunning)
    setAutoTagProgress(null)
    setIsAutoTagRunning(true)
    pollAbortRef.current = false

    const started = (await chrome.runtime.sendMessage({ type: AUTOTAG_RUN_MESSAGE })) as
      | { started?: boolean; alreadyRunning?: boolean }
      | undefined

    if (started?.alreadyRunning) {
      setIsAutoTagRunning(false)
      setAutoTagRunMessage(copy.settingsAutoTagAlreadyRunning)
      return
    }

    for (let attempt = 0; attempt < AUTOTAG_POLL_ATTEMPTS; attempt += 1) {
      if (pollAbortRef.current) {
        return
      }

      await new Promise((resolve) => setTimeout(resolve, AUTOTAG_POLL_INTERVAL_MS))

      const latest = await getSettings().catch(() => null)
      const summary = latest?.lastAutoTagRun

      if (summary && summary.finishedAt !== previousFinishedAt) {
        setAutoTagRunSummary(summary)
        setAutoTagProgress(null)
        setIsAutoTagRunning(false)
        setAutoTagRunMessage(null)
        return
      }
    }

    setIsAutoTagRunning(false)
    setAutoTagRunMessage(copy.settingsAutoTagRunTimeout)
  }

  function handleBufferPagesChange(rawValue: string) {
    if (!settings) {
      return
    }

    const value = Number(rawValue)
    if (Number.isFinite(value) && value >= 1) {
      persistSettings({ incrementalStopBufferPages: Math.trunc(value) })
    }
  }

  const sectionLabels: Record<SettingsSection, string> = {
    general: copy.settingsSectionGeneral,
    sync: copy.settingsSectionSync,
    autotag: copy.settingsSectionAutoTag,
    "data-safety": copy.settingsSectionDataSafety
  }

  return (
    <section data-testid="settings-panel" role="presentation" className="options-detail-modal">
      <button
        type="button"
        data-testid="settings-backdrop"
        aria-label={copy.closeSettings}
        className="options-detail-backdrop"
        onClick={onClose}
      />
      <div className="options-detail-focus-card options-settings-card">
        <div className="options-settings-dialog">
          <header className="options-settings-header">
            <h2 className="options-settings-title">{copy.settingsTitle}</h2>
            <button
              type="button"
              data-testid="settings-close"
              aria-label={copy.closeSettings}
              className="options-footer-icon-button"
              onClick={onClose}>
              <AppIcon name="close" size={14} />
            </button>
          </header>

          <div className="options-settings-body">
            <nav className="options-settings-nav" aria-label={copy.settingsTitle}>
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  data-testid={`settings-nav-${section}`}
                  className={cn("options-settings-nav-item", activeSection === section && "is-active")}
                  onClick={() => setActiveSection(section)}>
                  {sectionLabels[section]}
                </button>
              ))}
            </nav>

            <div className="options-settings-content">
              {activeSection === "general" ? (
                <div data-testid="settings-section-general" className="options-settings-section">
                  <label className="options-settings-field">
                    <span className="options-settings-field-label">{copy.languageLabel}</span>
                    <select
                      data-testid="settings-locale-select"
                      className="field-shell"
                      value={locale}
                      onChange={(event) => void setLocale(event.currentTarget.value as Locale)}>
                      <option value="zh-CN">{copy.settingsLanguageZh}</option>
                      <option value="en">{copy.settingsLanguageEn}</option>
                    </select>
                  </label>
                  <label className="options-settings-field">
                    <span className="options-settings-field-label">{copy.themeLabel}</span>
                    <select
                      data-testid="settings-theme-select"
                      className="field-shell"
                      value={themePreference}
                      onChange={(event) => void setThemePreference(event.currentTarget.value as ThemePreference)}>
                      <option value="system">{copy.settingsThemeSystem}</option>
                      <option value="light">{copy.settingsThemeLight}</option>
                      <option value="dark">{copy.settingsThemeDark}</option>
                    </select>
                  </label>
                </div>
              ) : null}

              {activeSection === "sync" && settings ? (
                <div data-testid="settings-section-sync" className="options-settings-section">
                  <label className="options-settings-field">
                    <span className="options-settings-field-label">{copy.settingsIncrementalStopBufferPages}</span>
                    <input
                      data-testid="settings-sync-buffer-pages"
                      type="number"
                      min={1}
                      max={20}
                      className="field-shell"
                      value={settings.incrementalStopBufferPages ?? 3}
                      onInput={(event) => handleBufferPagesChange(event.currentTarget.value)}
                      onChange={(event) => handleBufferPagesChange(event.currentTarget.value)}
                    />
                    <span className="options-meta-copy">{copy.settingsIncrementalStopBufferPagesHint}</span>
                  </label>
                </div>
              ) : null}

              {activeSection === "autotag" && settings ? (
                <div data-testid="settings-section-autotag" className="options-settings-section">
                  <h3 className="options-settings-group-title">{copy.settingsGroupAutoTagBasics}</h3>
                  <SettingsToggleRow
                    testId="settings-autotag-enabled"
                    label={copy.settingsAutoTagEnabled}
                    hint={copy.settingsAutoTagEnabledHint}
                    checked={settings.autoTag.enabled}
                    onChange={(checked) => updateAutoTag({ enabled: checked })}
                  />
                  <SettingsToggleRow
                    testId="settings-autotag-run-after-sync"
                    label={copy.settingsAutoTagRunAfterSync}
                    checked={settings.autoTag.runAfterSync}
                    onChange={(checked) => updateAutoTag({ runAfterSync: checked })}
                  />
                  <SettingsToggleRow
                    testId="settings-autotag-use-hashtags"
                    label={copy.settingsAutoTagUseHashtags}
                    checked={settings.autoTag.heuristics.useHashtags}
                    onChange={(checked) => updateHeuristics({ useHashtags: checked })}
                  />
                  <SettingsToggleRow
                    testId="settings-autotag-use-authors"
                    label={copy.settingsAutoTagUseAuthors}
                    checked={settings.autoTag.heuristics.useAuthors}
                    onChange={(checked) => updateHeuristics({ useAuthors: checked })}
                  />

                  <div className="options-settings-field">
                    <span className="options-settings-field-label">{copy.settingsAutoTagKeywordRules}</span>
                    <span className="options-meta-copy">{copy.settingsAutoTagKeywordRulesHint}</span>
                    {settings.autoTag.heuristics.keywordRules.length ? (
                      <div className="options-settings-rule-list">
                        {settings.autoTag.heuristics.keywordRules.map((rule, index) => (
                          <div
                            key={`${rule.keyword}-${rule.tagName}-${index}`}
                            data-testid="settings-keyword-rule-row"
                            className="options-settings-rule-row">
                            <span className="truncate">{rule.keyword}</span>
                            <span aria-hidden="true">→</span>
                            <span className="truncate">{rule.tagName}</span>
                            <button
                              type="button"
                              data-testid="settings-keyword-rule-remove"
                              aria-label={copy.settingsRemoveKeywordRule}
                              className="options-footer-icon-button"
                              onClick={() => removeKeywordRule(index)}>
                              <AppIcon name="close" size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="options-settings-rule-editor">
                      <input
                        data-testid="settings-keyword-rule-keyword"
                        className="field-shell"
                        placeholder={copy.settingsKeywordPlaceholder}
                        aria-label={copy.settingsKeywordPlaceholder}
                        value={draftKeyword}
                        onInput={(event) => setDraftKeyword(event.currentTarget.value)}
                        onChange={(event) => setDraftKeyword(event.currentTarget.value)}
                      />
                      <input
                        data-testid="settings-keyword-rule-tag"
                        className="field-shell"
                        placeholder={copy.settingsTagNamePlaceholder}
                        aria-label={copy.settingsTagNamePlaceholder}
                        value={draftTagName}
                        onInput={(event) => setDraftTagName(event.currentTarget.value)}
                        onChange={(event) => setDraftTagName(event.currentTarget.value)}
                      />
                      <button
                        type="button"
                        data-testid="settings-keyword-rule-add"
                        className="chip-button"
                        onClick={addKeywordRule}>
                        {copy.settingsAddKeywordRule}
                      </button>
                    </div>
                  </div>

                  <div className="options-settings-field">
                    <div className="options-settings-actions">
                      <button
                        type="button"
                        data-testid="settings-autotag-run-now"
                        className="chip-button"
                        disabled={isAutoTagRunning}
                        onClick={() => void runAutoTagNow()}>
                        {isAutoTagRunning ? copy.settingsAutoTagProgress : copy.settingsRunAutoTagNow}
                      </button>
                    </div>
                    <InlineMessage message={autoTagRunMessage} tone="info" />
                    {autoTagProgress ? (
                      <p data-testid="settings-autotag-progress" className="options-meta-copy">
                        {`${copy.settingsAutoTagProgress} · ${autoTagProgress.phase} ${autoTagProgress.processed}/${autoTagProgress.total}`}
                      </p>
                    ) : null}
                    {autoTagRunSummary ? (
                      <div data-testid="settings-autotag-result" className="options-settings-result">
                        <p className="options-settings-field-label">{copy.settingsAutoTagResultTitle}</p>
                        <p data-testid="settings-autotag-result-at" className="options-meta-copy">
                          {copy.settingsAutoTagResultAt.replace(
                            "{time}",
                            formatTimestamp(autoTagRunSummary.finishedAt, locale)
                          )}
                        </p>
                        <p className="options-meta-copy">{describeAutoTagOutcome(autoTagRunSummary, copy)}</p>
                        <p className="options-meta-copy">{describeAutoTagDetail(autoTagRunSummary, copy)}</p>
                        {autoTagRunSummary.blockedTagKeyCount ? (
                          <p data-testid="settings-autotag-blocked" className="options-meta-copy">
                            {copy.settingsAutoTagResultBlocked.replace(
                              "{blocked}",
                              String(autoTagRunSummary.blockedTagKeyCount)
                            )}
                          </p>
                        ) : null}
                        {autoTagRunSummary.blockedDroppedCount ? (
                          <p data-testid="settings-autotag-blocked-dropped" className="options-meta-copy">
                            {copy.settingsAutoTagResultBlockedDropped.replace(
                              "{dropped}",
                              String(autoTagRunSummary.blockedDroppedCount)
                            )}
                          </p>
                        ) : null}
                        {autoTagRunSummary.budgetDroppedCount ? (
                          <p data-testid="settings-autotag-budget-dropped" className="options-meta-copy">
                            {copy.settingsAutoTagResultBudgetDropped.replace(
                              "{dropped}",
                              String(autoTagRunSummary.budgetDroppedCount)
                            )}
                          </p>
                        ) : null}
                        {autoTagRunSummary.newTagBudget === 0 &&
                        settings.autoTag.llm.tagVocabularyMode !== "closed" ? (
                          <p data-testid="settings-autotag-vocabulary-full" className="options-meta-copy">
                            {copy.settingsAutoTagVocabularyFull}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {settings.autoTag.blockedTagKeys.length ? (
                      <div className="options-settings-actions">
                        <button
                          type="button"
                          data-testid="settings-autotag-clear-blocked"
                          className="chip-button"
                          onClick={() => void clearBlockedTags()}>
                          {`${copy.settingsClearBlockedTags} (${settings.autoTag.blockedTagKeys.length})`}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <h3 className="options-settings-group-title">{copy.settingsGroupAutoTagLlm}</h3>
                  <SettingsToggleRow
                    testId="settings-llm-enabled"
                    label={copy.settingsLlmEnabled}
                    hint={copy.settingsLlmEnabledHint}
                    checked={settings.autoTag.llm.enabled}
                    onChange={(checked) => void handleLlmEnabledChange(checked)}
                  />

                  <label className="options-settings-field">
                    <span className="options-settings-field-label">{copy.settingsLlmBaseUrl}</span>
                    <input
                      data-testid="settings-llm-base-url"
                      className="field-shell"
                      value={settings.autoTag.llm.baseUrl}
                      onInput={(event) => updateLlm({ baseUrl: event.currentTarget.value })}
                      onChange={(event) => updateLlm({ baseUrl: event.currentTarget.value })}
                    />
                    <span className="options-meta-copy">{copy.settingsLlmBaseUrlHint}</span>
                  </label>

                  <label className="options-settings-field">
                    <span className="options-settings-field-label">{copy.settingsLlmModel}</span>
                    <input
                      data-testid="settings-llm-model"
                      className="field-shell"
                      value={settings.autoTag.llm.model}
                      onInput={(event) => updateLlm({ model: event.currentTarget.value })}
                      onChange={(event) => updateLlm({ model: event.currentTarget.value })}
                    />
                  </label>

                  <div className="options-settings-field options-settings-field-wide">
                    <span className="options-settings-field-label">{copy.settingsLlmApiKey}</span>
                    <span className="options-meta-copy">{copy.settingsLlmApiKeyHint}</span>
                    <div className="options-settings-inline-field">
                      <input
                        data-testid="settings-llm-api-key"
                        className="field-shell options-settings-inline-input"
                        type="password"
                        placeholder={hasStoredApiKey ? "••••••••" : "sk-..."}
                        aria-label={copy.settingsLlmApiKey}
                        value={draftApiKey}
                        onInput={(event) => setDraftApiKey(event.currentTarget.value)}
                        onChange={(event) => setDraftApiKey(event.currentTarget.value)}
                      />
                      <button
                        type="button"
                        data-testid="settings-llm-api-key-save"
                        className="chip-button"
                        disabled={!draftApiKey.trim()}
                        onClick={() => void persistDraftApiKey(draftApiKey.trim())}>
                        {copy.settingsLlmApiKeySave}
                      </button>
                      {hasStoredApiKey ? (
                        <button
                          type="button"
                          data-testid="settings-llm-api-key-clear"
                          className="chip-button options-chip-muted"
                          onClick={() => void clearStoredApiKey()}>
                          {copy.settingsLlmApiKeyClear}
                        </button>
                      ) : null}
                    </div>
                    <span data-testid="settings-llm-api-key-status" className="options-settings-field-status">
                      {hasStoredApiKey ? copy.settingsLlmApiKeyStored : copy.settingsLlmApiKeyMissing}
                    </span>
                  </div>

                  <label className="options-settings-field">
                    <span className="options-settings-field-label">{copy.settingsLlmVocabularyMode}</span>
                    <select
                      data-testid="settings-llm-vocabulary-mode"
                      className="field-shell"
                      value={settings.autoTag.llm.tagVocabularyMode}
                      onChange={(event) =>
                        updateLlm({
                          tagVocabularyMode:
                            event.currentTarget.value === "open"
                              ? "open"
                              : event.currentTarget.value === "guarded"
                                ? "guarded"
                                : "closed"
                        })
                      }>
                      <option value="closed">{copy.settingsLlmVocabularyClosed}</option>
                      <option value="guarded">{copy.settingsLlmVocabularyGuarded}</option>
                      <option value="open">{copy.settingsLlmVocabularyOpen}</option>
                    </select>
                  </label>

                  <label className="options-settings-field">
                    <span className="options-settings-field-label">{copy.settingsLlmMaxPerRun}</span>
                    <input
                      data-testid="settings-llm-max-per-run"
                      type="number"
                      min={1}
                      max={2000}
                      className="field-shell"
                      value={settings.autoTag.llm.maxBookmarksPerRun}
                      onInput={(event) => {
                        const value = Number(event.currentTarget.value)
                        if (Number.isFinite(value) && value >= 1) {
                          updateLlm({ maxBookmarksPerRun: Math.trunc(value) })
                        }
                      }}
                      onChange={(event) => {
                        const value = Number(event.currentTarget.value)
                        if (Number.isFinite(value) && value >= 1) {
                          updateLlm({ maxBookmarksPerRun: Math.trunc(value) })
                        }
                      }}
                    />
                  </label>

                  <div className="options-settings-field">
                    <div className="options-settings-actions">
                      <button
                        type="button"
                        data-testid="settings-llm-test-connection"
                        className="chip-button"
                        disabled={llmTestState.status === "testing"}
                        onClick={() => void testLlmConnection()}>
                        {llmTestState.status === "testing" ? copy.settingsLlmTesting : copy.settingsLlmTestConnection}
                      </button>
                    </div>
                    <InlineMessage
                      message={
                        llmTestState.status === "ok"
                          ? copy.settingsLlmTestSuccess
                          : llmTestState.status === "error"
                            ? llmTestState.error
                              ? `${copy.settingsLlmTestFailure}: ${llmTestState.error}`
                              : copy.settingsLlmTestFailure
                            : null
                      }
                      tone={llmTestState.status === "ok" ? "info" : "error"}
                    />
                  </div>
                </div>
              ) : null}

              {activeSection === "data-safety" ? (
                <div data-testid="settings-section-data-safety" className="options-settings-section">
                  <p className="options-settings-section-intro">{copy.settingsDataSafetyHint}</p>
                  <div className="options-settings-action-list">
                    <div className="options-settings-action-row">
                      <span className="options-settings-action-copy">
                        <span className="options-settings-action-title">{copy.exportData}</span>
                        <span className="options-meta-copy">{copy.settingsExportDataHint}</span>
                      </span>
                      <button
                        type="button"
                        data-testid="settings-export-data"
                        className="chip-button"
                        disabled={workspace.isExporting}
                        onClick={() => void workspace.handleExportWorkspace()}>
                        {workspace.isExporting ? copy.exporting : copy.exportData}
                      </button>
                    </div>
                    <div className="options-settings-action-row">
                      <span className="options-settings-action-copy">
                        <span className="options-settings-action-title">{copy.restoreBackup}</span>
                        <span className="options-meta-copy">{copy.settingsRestoreDataHint}</span>
                      </span>
                      <button
                        type="button"
                        data-testid="settings-restore-backup"
                        className="chip-button"
                        disabled={workspace.isValidatingBackup || workspace.isRestoringBackup}
                        onClick={dataSafety.openRestorePicker}>
                        {workspace.isRestoringBackup ? copy.restoringBackup : copy.restoreBackup}
                      </button>
                    </div>
                    <div className="options-settings-action-row options-settings-action-row-danger">
                      <span className="options-settings-action-copy">
                        <span className="options-settings-action-title">{copy.resetLocalData}</span>
                        <span className="options-meta-copy">{copy.settingsResetDataHint}</span>
                      </span>
                      <button
                        type="button"
                        data-testid="settings-reset-local"
                        className="chip-button chip-button-danger"
                        disabled={workspace.isResettingData}
                        onClick={() => void dataSafety.handleResetLocalData()}>
                        {workspace.isResettingData ? copy.resettingData : copy.resetLocalData}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
