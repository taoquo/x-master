import type { KnowledgeCardDraftRecord, OnboardingStep } from "../../lib/types.ts"

export function deriveOnboardingStep({
  hasCompletedOnboarding,
  sourceMaterialCount,
  knowledgeCards
}: {
  hasCompletedOnboarding: boolean
  sourceMaterialCount: number
  knowledgeCards: KnowledgeCardDraftRecord[]
}): OnboardingStep {
  if (hasCompletedOnboarding) {
    return "done"
  }

  if (sourceMaterialCount === 0) {
    return "sync-source"
  }

  if (knowledgeCards.length === 0) {
    return "generate-cards"
  }

  const reviewedCount = knowledgeCards.filter((card) => card.status === "reviewed" && !card.quality.needsReview).length
  if (reviewedCount === 0) {
    return "review-cards"
  }

  return "export-vault"
}
