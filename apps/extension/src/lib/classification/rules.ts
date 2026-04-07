import { bookmarkHasMedia, bookmarkIsLongform } from "../search/searchBookmarks.ts"
import type { BookmarkRecord, BookmarkTagRecord, ClassificationRule } from "../types.ts"

function normalizeToken(value: string) {
  return value.trim().toLowerCase()
}

function normalizeHandle(value: string) {
  return normalizeToken(value).replace(/^@+/, "")
}

function includesAnyKeyword(text: string, keywords: string[]) {
  const normalizedText = normalizeToken(text)
  return keywords.some((keyword) => normalizedText.includes(normalizeToken(keyword)))
}

export function ruleMatchesBookmark(bookmark: BookmarkRecord, rule: ClassificationRule) {
  if (!rule.enabled) {
    return false
  }

  const normalizedAuthorHandle = normalizeHandle(bookmark.authorHandle)
  const normalizedAuthorRules = rule.authorHandles.map(normalizeHandle).filter(Boolean)
  const normalizedKeywords = rule.keywords.map(normalizeToken).filter(Boolean)

  if (normalizedAuthorRules.length > 0 && !normalizedAuthorRules.includes(normalizedAuthorHandle)) {
    return false
  }

  if (normalizedKeywords.length > 0 && !includesAnyKeyword(bookmark.text, normalizedKeywords)) {
    return false
  }

  if (rule.requireMedia && !bookmarkHasMedia(bookmark)) {
    return false
  }

  if (rule.requireLongform && !bookmarkIsLongform(bookmark)) {
    return false
  }

  return true
}

export function collectRuleTagAssignments({
  bookmarks,
  rules,
  existingBookmarkTags,
  validTagIds
}: {
  bookmarks: BookmarkRecord[]
  rules: ClassificationRule[]
  existingBookmarkTags: BookmarkTagRecord[]
  validTagIds?: Set<string>
}) {
  const existingRelationIds = new Set(existingBookmarkTags.map((bookmarkTag) => `${bookmarkTag.bookmarkId}:${bookmarkTag.tagId}`))
  const assignments: Array<{ bookmarkId: string; tagId: string }> = []

  for (const bookmark of bookmarks) {
    const targetTagIds = new Set<string>()

    for (const rule of rules) {
      if (!ruleMatchesBookmark(bookmark, rule)) {
        continue
      }

      for (const tagId of rule.targetTagIds) {
        if (!tagId || (validTagIds && !validTagIds.has(tagId))) {
          continue
        }

        targetTagIds.add(tagId)
      }
    }

    for (const tagId of targetTagIds) {
      const relationId = `${bookmark.tweetId}:${tagId}`
      if (existingRelationIds.has(relationId)) {
        continue
      }

      existingRelationIds.add(relationId)
      assignments.push({
        bookmarkId: bookmark.tweetId,
        tagId
      })
    }
  }

  return assignments
}
