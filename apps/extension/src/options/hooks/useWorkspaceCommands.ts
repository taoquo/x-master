import { useCallback, useState } from "react"
import { exportKnowledgeCardsAsObsidianVault } from "../../lib/export/exportKnowledgeCards.ts"
import { attachTagToBookmark, attachTagToBookmarks, createTag, deleteTag, detachTagFromBookmark, renameTag } from "../../lib/storage/tagsStore.ts"
import { updateKnowledgeCardDraft } from "../../lib/storage/knowledgeCardsStore.ts"
import { regenerateKnowledgeCard, resetStoredData, runSync } from "../../lib/runtime/popupClient.ts"
import { saveExportScope, setHasCompletedOnboarding } from "../../lib/storage/settings.ts"
import type { BookmarkRecord, BookmarkTagRecord, ExportScope, KnowledgeCardDraftRecord, TagRecord } from "../../lib/types.ts"

function downloadFile(filename: string, content: Blob | string, mimeType: string) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return
  }

  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

interface UseWorkspaceCommandsOptions {
  bookmarks: BookmarkRecord[]
  knowledgeCards?: KnowledgeCardDraftRecord[]
  bookmarkTags?: BookmarkTagRecord[]
  tags?: TagRecord[]
  exportScope?: ExportScope
  refreshData: () => Promise<void>
}

export interface ExportSummary {
  fileName: string
  cardCount: number
  sourceCount: number
  draftCount: number
  reviewedCount: number
  staleCount: number
  exportedAt: string
}

export function useWorkspaceCommands({ bookmarks, knowledgeCards = [], bookmarkTags = [], tags = [], exportScope = "all", refreshData }: UseWorkspaceCommandsOptions) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [lastExportSummary, setLastExportSummary] = useState<ExportSummary | null>(null)
  const [isSavingExportScope, setIsSavingExportScope] = useState(false)

  const handleSync = useCallback(async () => {
    setIsSyncing(true)

    try {
      await runSync()
    } catch {
      // The background sync persists the failed summary; refresh after the request settles.
    } finally {
      await refreshData()
      setIsSyncing(false)
    }
  }, [refreshData])

  const handleCreateTag = useCallback(
    async (name: string) => {
      const trimmedName = name.trim()
      if (!trimmedName) {
        return
      }

      setIsSavingTag(true)
      try {
        await createTag({ name: trimmedName })
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleRenameTag = useCallback(
    async (tagId: string, name: string) => {
      const trimmedName = name.trim()
      if (!trimmedName) {
        return
      }

      setIsSavingTag(true)
      try {
        await renameTag({ tagId, name: trimmedName })
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      setIsSavingTag(true)
      try {
        await deleteTag(tagId)
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleAttachTag = useCallback(
    async (bookmarkId: string, tagId: string) => {
      setIsSavingTag(true)
      try {
        await attachTagToBookmark({ bookmarkId, tagId })
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleDetachTag = useCallback(
    async (bookmarkId: string, tagId: string) => {
      setIsSavingTag(true)
      try {
        await detachTagFromBookmark({ bookmarkId, tagId })
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleBulkAttachTag = useCallback(
    async (bookmarkIds: string[], tagId: string) => {
      setIsSavingTag(true)
      try {
        await attachTagToBookmarks({ bookmarkIds, tagId })
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleUpdateKnowledgeCardDraft = useCallback(
    async (
      cardId: string,
      updates: Pick<KnowledgeCardDraftRecord, "title" | "theme" | "summary" | "keyExcerpt" | "applicability">
    ) => {
      setIsSavingTag(true)
      try {
        await updateKnowledgeCardDraft(cardId, updates)
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleRegenerateKnowledgeCardDraft = useCallback(
    async (cardId: string) => {
      setIsSavingTag(true)
      try {
        await regenerateKnowledgeCard(cardId)
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleExport = useCallback(async () => {
    setIsExporting(true)

    try {
      const cardsToExport = knowledgeCards.filter((card) => {
        if (exportScope === "all") {
          return true
        }

        if (exportScope === "reviewed") {
          return card.status === "reviewed" && !card.quality.needsReview
        }

        return card.status === "reviewed"
      })
      const payload = await exportKnowledgeCardsAsObsidianVault({
        cards: cardsToExport,
        sourceMaterials: bookmarks.map((bookmark) => ({
          ...bookmark,
          sourceKind: "x-bookmark" as const
        })),
        bookmarkTags,
        tags
      })
      const summary: ExportSummary = {
        fileName: "x-knowledge-cards-obsidian.zip",
        cardCount: cardsToExport.length,
        sourceCount: bookmarks.length,
        draftCount: cardsToExport.filter((card) => card.status === "draft").length,
        reviewedCount: cardsToExport.filter((card) => card.status === "reviewed" && !card.quality.needsReview).length,
        staleCount: cardsToExport.filter((card) => card.status === "reviewed" && card.quality.needsReview).length,
        exportedAt: new Date().toISOString()
      }
      downloadFile(summary.fileName, payload, "application/zip")
      setLastExportSummary(summary)
      await setHasCompletedOnboarding(true)
      return summary
    } finally {
      setIsExporting(false)
    }
  }, [bookmarkTags, bookmarks, exportScope, knowledgeCards, tags])

  const handleSaveExportScope = useCallback(
    async (nextExportScope: ExportScope) => {
      setIsSavingExportScope(true)
      try {
        await saveExportScope(nextExportScope)
        await refreshData()
      } finally {
        setIsSavingExportScope(false)
      }
    },
    [refreshData]
  )

  const handleReset = useCallback(async () => {
    setIsResetting(true)

    try {
      await resetStoredData()
      await refreshData()
    } finally {
      setIsResetting(false)
    }
  }, [refreshData])

  return {
    isSyncing,
    isSavingTag,
    isResetting,
    isExporting,
    isSavingExportScope,
    lastExportSummary,
    handleSync,
    handleCreateTag,
    handleRenameTag,
    handleDeleteTag,
    handleAttachTag,
    handleDetachTag,
    handleBulkAttachTag,
    handleUpdateKnowledgeCardDraft,
    handleRegenerateKnowledgeCardDraft,
    handleExport,
    handleSaveExportScope,
    handleReset
  }
}
