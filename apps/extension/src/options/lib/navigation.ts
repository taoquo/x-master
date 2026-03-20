export type OptionsSection = "dashboard" | "inbox" | "library" | "settings"

export type LibraryView = "all" | "tags" | "folders"

export interface InboxRouteState {
  publishedDate?: string
}
