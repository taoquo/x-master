import { useCallback, useEffect, useState } from "react"
import {
  createEmptySyncSummary,
  type BookmarkRecord,
  type BookmarkTagRecord,
  type KnowledgeCardDraftRecord,
  type AiGenerationSettings,
  type SourceMaterialRecord,
  type SyncRunRecord,
  type SyncSummary,
  type TagRecord,
  type ExportScope
} from "../../lib/types.ts"
import { loadPopupData } from "../../lib/runtime/popupClient.ts"
import { deriveOnboardingStep } from "../lib/onboarding.ts"

const defaultAiGeneration: AiGenerationSettings = {
  enabled: false,
  provider: "openai",
  apiKey: "",
  model: "gpt-5-mini"
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load workspace data"
}

export function useWorkspaceQueries() {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([])
  const [sourceMaterials, setSourceMaterials] = useState<SourceMaterialRecord[]>([])
  const [knowledgeCards, setKnowledgeCards] = useState<KnowledgeCardDraftRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [bookmarkTags, setBookmarkTags] = useState<BookmarkTagRecord[]>([])
  const [aiGeneration, setAiGeneration] = useState<AiGenerationSettings>(defaultAiGeneration)
  const [exportScope, setExportScope] = useState<ExportScope>("all")
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [summary, setSummary] = useState<SyncSummary>({
    ...createEmptySyncSummary(),
    status: "idle"
  })
  const [latestSyncRun, setLatestSyncRun] = useState<SyncRunRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshData = useCallback(async () => {
    setIsLoading(true)

    try {
      const data = await loadPopupData()
      setBookmarks(data.bookmarks)
      setSourceMaterials(data.sourceMaterials)
      setKnowledgeCards(data.knowledgeCards)
      setTags(data.tags)
      setBookmarkTags(data.bookmarkTags)
      setAiGeneration(data.aiGeneration ?? defaultAiGeneration)
      setExportScope(data.exportScope ?? "all")
      setHasCompletedOnboarding(data.hasCompletedOnboarding ?? false)
      setSummary(data.summary)
      setLatestSyncRun(data.latestSyncRun)
      setLoadError(null)
    } catch (error) {
      setLoadError(toErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  return {
    bookmarks,
    sourceMaterials,
    knowledgeCards,
    tags,
    bookmarkTags,
    aiGeneration,
    exportScope,
    hasCompletedOnboarding,
    onboardingStep: deriveOnboardingStep({
      hasCompletedOnboarding,
      sourceMaterialCount: sourceMaterials.length,
      knowledgeCards
    }),
    summary,
    latestSyncRun,
    isLoading,
    loadError,
    refreshData
  }
}
