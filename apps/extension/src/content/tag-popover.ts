import type { Locale, SiteTweetDraft, SiteTweetTagState } from "../lib/types.ts"
import type { SiteTaggingClient } from "./site-client.ts"

const TAG_MODAL_LOGO_PATH = "assets/branding/logo-72.png"
const POPOVER_STYLE = `
  :host {
    all: initial;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(circle at top, rgba(111, 215, 225, 0.16), transparent 30%),
      rgba(15, 23, 42, 0.34);
    backdrop-filter: blur(10px);
    animation: fade-in 180ms ease;
  }

  .viewport {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px 16px;
    box-sizing: border-box;
  }

  .popover {
    position: relative;
    width: min(480px, calc(100vw - 32px));
    max-height: min(640px, calc(100vh - 48px));
    overflow: auto;
    border: 1px solid rgba(148, 226, 232, 0.42);
    border-radius: 28px;
    background:
      linear-gradient(180deg, rgba(251, 254, 255, 0.98), rgba(240, 250, 251, 0.96));
    box-shadow:
      0 34px 80px rgba(15, 23, 42, 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.82);
    color: #0f172a;
    font-family: Geist, "Avenir Next", "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.5;
    animation: pop-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .section {
    padding: 18px 22px;
  }

  .section + .section {
    border-top: 1px solid rgba(148, 163, 184, 0.16);
  }

  .hero {
    display: grid;
    gap: 16px;
    background:
      radial-gradient(circle at top left, rgba(111, 215, 225, 0.24), transparent 42%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(241, 249, 250, 0.72));
  }

  .hero-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .brand-badge {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at top, rgba(255, 255, 255, 0.92), rgba(224, 244, 245, 0.88));
    border: 1px solid rgba(148, 226, 232, 0.45);
    box-shadow:
      0 14px 28px rgba(15, 23, 42, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }

  .brand-badge img {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    object-fit: cover;
    display: block;
  }

  .eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #4b7f87;
    margin-bottom: 4px;
  }

  .headline {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
    color: #0f172a;
  }

  .subcopy {
    margin-top: 6px;
    color: #4b5563;
    font-size: 13px;
  }

  .icon-button {
    appearance: none;
    width: 34px;
    height: 34px;
    flex: none;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.74);
    color: #334155;
    font: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    transition: transform 160ms ease, background 160ms ease;
  }

  .icon-button:hover {
    background: rgba(255, 255, 255, 0.96);
    transform: translateY(-1px);
  }

  .icon-button:active {
    transform: scale(0.98);
  }

  .tweet-card {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid rgba(148, 163, 184, 0.16);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  }

  .tweet-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: #4b5563;
    font-size: 12px;
  }

  .tweet-author {
    color: #0f172a;
    font-weight: 600;
  }

  .tweet-text {
    color: #1e293b;
    font-size: 14px;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow: hidden;
  }

  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #64748b;
  }

  .tags {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
    gap: 10px;
  }

  .tag-option {
    position: relative;
    display: grid;
    gap: 4px;
    min-width: 0;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(255, 255, 255, 0.76);
    cursor: pointer;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease;
  }

  .tag-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .tag-option:hover {
    transform: translateY(-1px);
    border-color: rgba(99, 195, 205, 0.45);
  }

  .tag-option[data-selected="true"] {
    border-color: rgba(70, 191, 202, 0.56);
    background:
      linear-gradient(180deg, rgba(236, 250, 251, 0.96), rgba(223, 246, 247, 0.92));
    box-shadow:
      0 12px 26px rgba(74, 190, 201, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.82);
  }

  .tag-option:active {
    transform: scale(0.985);
  }

  .tag-name {
    min-width: 0;
    font-weight: 600;
    color: #0f172a;
  }

  .tag-state {
    font-size: 12px;
    color: #5b6b7f;
  }

  .empty,
  .status,
  .error {
    padding: 16px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.62);
    border: 1px dashed rgba(148, 163, 184, 0.24);
    color: #475569;
  }

  .error {
    background: rgba(254, 242, 242, 0.9);
    border-color: rgba(248, 113, 113, 0.24);
    color: #b91c1c;
  }

  .button {
    appearance: none;
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.76);
    color: #0f172a;
    font: inherit;
    font-weight: 600;
    padding: 10px 14px;
    cursor: pointer;
    transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
  }

  .button:hover {
    background: rgba(245, 252, 252, 0.98);
    border-color: rgba(83, 193, 203, 0.32);
    transform: translateY(-1px);
  }

  .button:active {
    transform: scale(0.98);
  }

  .button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .create-row {
    display: grid;
    gap: 10px;
  }

  .create-trigger-row {
    display: flex;
    justify-content: flex-start;
  }

  .create-input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.84);
    padding: 12px 14px;
    font: inherit;
    color: inherit;
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .create-input:focus {
    border-color: rgba(69, 191, 202, 0.5);
    box-shadow: 0 0 0 4px rgba(98, 210, 219, 0.12);
  }

  .create-actions {
    display: flex;
    gap: 8px;
  }

  .create-actions .button[data-variant="primary"] {
    background:
      linear-gradient(180deg, rgba(79, 199, 210, 0.96), rgba(57, 179, 191, 0.96));
    border-color: rgba(53, 157, 167, 0.44);
    color: #f8fafc;
  }

  .create-actions .button[data-variant="primary"]:hover {
    background:
      linear-gradient(180deg, rgba(74, 191, 201, 0.98), rgba(51, 168, 180, 0.98));
  }

  .section-note {
    color: #64748b;
    font-size: 12px;
    margin-top: 2px;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(14px) scale(0.96);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`

interface SiteTagPopoverOptions {
  document: Document
  client: SiteTaggingClient
  onOpenStateChange?: (triggerHost: HTMLElement | null, isOpen: boolean) => void
}

interface PopoverState {
  tweet: SiteTweetDraft | null
  bookmarkId: string | null
  tags: SiteTweetTagState["tags"]
  selectedTagIds: string[]
  locale: Locale
  loading: boolean
  saving: boolean
  error: string | null
  createMode: boolean
  createValue: string
}

export class SiteTagPopover {
  private document: Document
  private client: SiteTaggingClient
  private host: HTMLDivElement | null = null
  private shadowRootRef: ShadowRoot | null = null
  private triggerHost: HTMLElement | null = null
  private isOpen = false
  private state: PopoverState = {
    tweet: null,
    bookmarkId: null,
    tags: [],
    selectedTagIds: [],
    locale: "zh-CN",
    loading: false,
    saving: false,
    error: null,
    createMode: false,
    createValue: ""
  }
  private onOpenStateChange?: (triggerHost: HTMLElement | null, isOpen: boolean) => void
  private handlePointerDown = (event: Event) => {
    if (!this.isOpen) {
      return
    }

    const path = "composedPath" in event ? (event.composedPath() as EventTarget[]) : []
    const panel = this.shadowRootRef?.querySelector('[data-testid="site-tag-popover"]')
    if (panel && path.includes(panel)) {
      return
    }

    this.close()
  }
  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.isOpen) {
      event.preventDefault()
      this.close()
    }
  }
  constructor({ document, client, onOpenStateChange }: SiteTagPopoverOptions) {
    this.document = document
    this.client = client
    this.onOpenStateChange = onOpenStateChange
  }

  async open({
    anchor: _anchor,
    triggerHost,
    tweet
  }: {
    anchor: HTMLElement
    triggerHost: HTMLElement | null
    tweet: SiteTweetDraft
  }) {
    this.ensureHost()
    this.triggerHost = triggerHost
    this.isOpen = true
    this.state = {
      tweet,
      bookmarkId: null,
      tags: [],
      selectedTagIds: [],
      locale: "zh-CN",
      loading: true,
      saving: false,
      error: null,
      createMode: false,
      createValue: ""
    }

    this.onOpenStateChange?.(this.triggerHost, true)
    this.attachDocumentListeners()
    this.render()

    try {
      const state = await this.client.prepareSiteTweetTagging(tweet)
      if (!this.isOpen) {
        return
      }

      this.state = {
        ...this.state,
        ...state,
        loading: false,
        saving: false,
        error: null
      }
      this.render()
    } catch (error) {
      if (!this.isOpen) {
        return
      }

      this.state = {
        ...this.state,
        loading: false,
        saving: false,
        error: error instanceof Error ? error.message : String(error)
      }
      this.render()
    }
  }

  close() {
    if (!this.isOpen) {
      return
    }

    this.isOpen = false
    this.detachDocumentListeners()
    this.onOpenStateChange?.(this.triggerHost, false)
    this.triggerHost = null

    if (this.host) {
      this.host.remove()
      this.host = null
      this.shadowRootRef = null
    }
  }

  destroy() {
    this.close()
  }

  private ensureHost() {
    if (this.host && this.shadowRootRef) {
      return
    }

    const host = this.document.createElement("div")
    host.dataset.siteTagPopoverHost = "true"
    host.style.position = "fixed"
    host.style.zIndex = "2147483647"
    host.style.inset = "0"
    const shadowRootRef = host.attachShadow({ mode: "open" })
    shadowRootRef.innerHTML = `
      <style>${POPOVER_STYLE}</style>
      <div class="backdrop" data-testid="site-tag-modal-backdrop"></div>
      <div class="viewport">
        <div class="popover" data-testid="site-tag-popover" role="dialog" aria-modal="true"></div>
      </div>
    `

    this.document.body.appendChild(host)
    this.host = host
    this.shadowRootRef = shadowRootRef
  }

  private attachDocumentListeners() {
    this.document.addEventListener("pointerdown", this.handlePointerDown, true)
    this.document.addEventListener("keydown", this.handleKeyDown, true)
  }

  private detachDocumentListeners() {
    this.document.removeEventListener("pointerdown", this.handlePointerDown, true)
    this.document.removeEventListener("keydown", this.handleKeyDown, true)
  }

  private render() {
    if (!this.shadowRootRef) {
      return
    }

    const popover = this.shadowRootRef.querySelector<HTMLDivElement>('[data-testid="site-tag-popover"]')
    if (!popover) {
      return
    }

    const copy = getPopoverCopy(this.state.locale)
    const tweet = this.state.tweet
    const tweetPreview = tweet
      ? `
        <div class="tweet-card">
          <div class="tweet-meta">
            <span class="tweet-author">${this.escapeHtml(tweet.authorName)}</span>
            <span>@${this.escapeHtml(tweet.authorHandle)}</span>
          </div>
          <div class="tweet-text">${this.escapeHtml(tweet.text || copy.noPreview)}</div>
        </div>
      `
      : ""

    const content = this.state.loading
      ? `<div class="section"><div class="status">${copy.loading}</div></div>`
      : this.state.error
          ? `<div class="section"><div class="error">${this.escapeHtml(this.state.error)}</div></div>`
          : `
            <div class="section">
              <div class="title">
                <span>${copy.availableTags}</span>
                <span>${formatSelectedCount(this.state.selectedTagIds.length, this.state.locale)}</span>
              </div>
              ${
                this.state.tags.length
                  ? `<div class="tags">
                      ${this.state.tags
                        .map(
                          (tag) => `
                            <label class="tag-option" data-selected="${this.state.selectedTagIds.includes(tag.id) ? "true" : "false"}">
                              <input
                                type="checkbox"
                                data-testid="site-tag-option-${this.escapeHtml(tag.id)}"
                                data-tag-id="${this.escapeHtml(tag.id)}"
                                ${this.state.selectedTagIds.includes(tag.id) ? "checked" : ""}
                                ${this.state.saving ? "disabled" : ""}
                              />
                              <span class="tag-name">${this.escapeHtml(tag.name)}</span>
                              <span class="tag-state">${this.state.selectedTagIds.includes(tag.id) ? copy.attached : copy.clickToAttach}</span>
                            </label>
                          `
                        )
                        .join("")}
                    </div>`
                  : `<div class="empty">${copy.empty}</div>`
              }
            </div>
            <div class="section">
              <div class="title">
                <span>${copy.createTitle}</span>
              </div>
              <div class="section-note">${copy.createNote}</div>
              ${
                this.state.createMode
                  ? `
                    <div class="create-row">
                      <input
                        class="create-input"
                        data-testid="site-tag-create-input"
                        type="text"
                        value="${this.escapeHtml(this.state.createValue)}"
                        placeholder="${copy.newTagPlaceholder}"
                        ${this.state.saving ? "disabled" : ""}
                      />
                      <div class="create-actions">
                        <button class="button" data-testid="site-tag-create-submit" data-variant="primary" ${this.state.saving ? "disabled" : ""}>${copy.createAction}</button>
                        <button class="button" data-testid="site-tag-create-cancel" ${this.state.saving ? "disabled" : ""}>${copy.cancel}</button>
                      </div>
                    </div>
                  `
                  : `
                    <div class="create-trigger-row">
                      <button class="button" data-testid="site-tag-create-trigger" ${this.state.saving ? "disabled" : ""}>${copy.newTag}</button>
                    </div>
                  `
              }
            </div>
          `

    popover.setAttribute("aria-label", copy.dialogLabel)
    popover.innerHTML = `
      <div class="section hero">
        <div class="hero-row">
          <div class="brand">
            <div class="brand-badge">
              <img alt="" src="${this.escapeHtml(resolveExtensionAssetUrl(TAG_MODAL_LOGO_PATH))}" />
            </div>
            <div>
              <div class="eyebrow">${copy.eyebrow}</div>
              <div class="headline">${copy.headline}</div>
              <div class="subcopy">${copy.subcopy}</div>
            </div>
          </div>
          <button class="icon-button" data-testid="site-tag-close" type="button" aria-label="${copy.close}">×</button>
        </div>
        ${tweetPreview}
      </div>
      ${content}
    `
    this.bindEvents()
  }

  private bindEvents() {
    if (!this.shadowRootRef) {
      return
    }

    this.shadowRootRef.querySelectorAll<HTMLInputElement>("input[data-tag-id]").forEach((input) => {
      input.addEventListener("change", () => {
        void this.handleToggleTag(input.dataset.tagId ?? "", input.checked)
      })
    })

    const createTrigger = this.shadowRootRef.querySelector<HTMLButtonElement>('[data-testid="site-tag-create-trigger"]')
    createTrigger?.addEventListener("click", () => {
      this.state = {
        ...this.state,
        createMode: true,
        createValue: ""
      }
      this.render()

      const input = this.shadowRootRef?.querySelector<HTMLInputElement>('[data-testid="site-tag-create-input"]')
      input?.focus()
    })

    const closeButton = this.shadowRootRef.querySelector<HTMLButtonElement>('[data-testid="site-tag-close"]')
    closeButton?.addEventListener("click", () => {
      this.close()
    })

    const createInput = this.shadowRootRef.querySelector<HTMLInputElement>('[data-testid="site-tag-create-input"]')
    createInput?.addEventListener("input", () => {
      this.state = {
        ...this.state,
        createValue: createInput.value
      }
    })
    createInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        void this.handleCreateTag()
      }
    })

    const createSubmit = this.shadowRootRef.querySelector<HTMLButtonElement>('[data-testid="site-tag-create-submit"]')
    createSubmit?.addEventListener("click", () => {
      void this.handleCreateTag()
    })

    const createCancel = this.shadowRootRef.querySelector<HTMLButtonElement>('[data-testid="site-tag-create-cancel"]')
    createCancel?.addEventListener("click", () => {
      this.state = {
        ...this.state,
        createMode: false,
        createValue: ""
      }
      this.render()
    })
  }

  private async handleToggleTag(tagId: string, enabled: boolean) {
    const bookmarkId = this.state.bookmarkId
    if (!bookmarkId || !tagId) {
      return
    }

    this.state = {
      ...this.state,
      saving: true,
      error: null
    }
    this.render()

    try {
      const nextState = await this.client.setSiteTweetTag({
        bookmarkId,
        tagId,
        enabled
      })

      this.state = {
        ...this.state,
        ...nextState,
        saving: false,
        error: null
      }
    } catch (error) {
      this.state = {
        ...this.state,
        saving: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }

    this.render()
  }

  private async handleCreateTag() {
    const bookmarkId = this.state.bookmarkId
    if (!bookmarkId) {
      return
    }

    const name = this.state.createValue.trim()
    if (!name) {
      return
    }

    this.state = {
      ...this.state,
      saving: true,
      error: null
    }
    this.render()

    try {
      const nextState = await this.client.createSiteTweetTag({
        bookmarkId,
        name
      })

      this.state = {
        ...this.state,
        ...nextState,
        saving: false,
        error: null,
        createMode: false,
        createValue: ""
      }
    } catch (error) {
      this.state = {
        ...this.state,
        saving: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }

    this.render()
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }
}

function resolveExtensionAssetUrl(assetPath: string) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    try {
      return chrome.runtime.getURL(assetPath)
    } catch {
      return assetPath
    }
  }

  return assetPath
}

function getPopoverCopy(locale: Locale) {
  if (locale === "en") {
    return {
      eyebrow: "X Bookmark Manager",
      headline: "Manage tags for this tweet",
      subcopy: "Use tags to keep your X bookmarks organized without leaving the timeline.",
      dialogLabel: "Bookmark tags",
      close: "Close",
      noPreview: "No preview text available.",
      loading: "Loading tags…",
      availableTags: "Available tags",
      attached: "Attached to this tweet",
      clickToAttach: "Click to attach",
      empty: "No tags yet. Create one below to start organizing bookmarks.",
      createTitle: "Create a tag",
      createNote: "New tags will be attached to this tweet immediately after creation.",
      newTagPlaceholder: "New tag",
      createAction: "Create tag",
      cancel: "Cancel",
      newTag: "New tag"
    }
  }

  return {
    eyebrow: "X Bookmark Manager",
    headline: "管理这条推文的标签",
    subcopy: "使用标签整理你的 X 书签，无需离开时间线。",
    dialogLabel: "书签标签",
    close: "关闭",
    noPreview: "暂无推文摘要。",
    loading: "正在加载标签…",
    availableTags: "可用标签",
    attached: "已添加到这条推文",
    clickToAttach: "点击添加",
    empty: "还没有标签。先在下方创建一个开始整理书签。",
    createTitle: "新建标签",
    createNote: "创建成功后会立即附加到当前推文。",
    newTagPlaceholder: "输入标签名称",
    createAction: "创建标签",
    cancel: "取消",
    newTag: "新建标签"
  }
}

function formatSelectedCount(count: number, locale: Locale) {
  return locale === "en" ? `${count} selected` : `已选 ${count} 个`
}
