export type OptionsSection = "dashboard" | "inbox" | "library" | "settings"

export type LibraryView = "all" | "tags"

export type LibraryLifecycleFilter = "all" | "draft" | "reviewed" | "stale"

export interface InboxRouteState {
  publishedDate?: string
}

export interface LibraryRouteState {
  view?: LibraryView
  lifecycle?: LibraryLifecycleFilter
}
