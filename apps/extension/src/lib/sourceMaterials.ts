import type { BookmarkRecord, SourceMaterialKind, SourceMaterialRecord } from "./types.ts"

export function inferSourceKindFromBookmark(bookmark: Pick<BookmarkRecord, "sourceKind" | "rawPayload">): SourceMaterialKind {
  if (bookmark.sourceKind) {
    return bookmark.sourceKind
  }

  const rawPayload = bookmark.rawPayload as { note_tweet?: { note_tweet_results?: { result?: { text?: string } } } } | undefined
  return rawPayload?.note_tweet?.note_tweet_results?.result?.text ? "x-note-tweet" : "x-bookmark"
}

export function toSourceMaterialRecord(bookmark: BookmarkRecord): SourceMaterialRecord {
  return {
    ...bookmark,
    sourceKind: inferSourceKindFromBookmark(bookmark)
  }
}

export function getSourceKindLabel(sourceKind: SourceMaterialKind) {
  return sourceKind === "x-note-tweet" ? "Saved note" : "Saved post"
}
