import type { Locale, SiteTweetDraft, SiteTweetTagState } from "../lib/types.ts"
import type { SiteTaggingClient } from "./site-client.ts"

const TAG_MODAL_LOGO_PATH = "assets/branding/logo-72.png"
const WENKAI_REGULAR_PATH = "assets/fonts/LXGWWenKai-Regular.woff2"
const WENKAI_MEDIUM_PATH = "assets/fonts/LXGWWenKai-Medium.woff2"
const POPOVER_STYLE = `
  :host {
    all: initial;
    --theme-display-font: "LXGW WenKai", "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", serif;
    --theme-panel-bg: linear-gradient(180deg, rgba(251, 247, 243, 0.99), rgba(246, 240, 234, 0.98));
    --theme-panel-border: rgba(184, 61, 46, 0.14);
    --theme-panel-shadow: 0 34px 80px rgba(58, 49, 45, 0.24);
    --theme-elevated-bg: rgba(255, 253, 249, 0.84);
    --theme-elevated-border: rgba(228, 215, 203, 0.92);
    --theme-overlay-backdrop: rgba(25, 21, 20, 0.34);
    --theme-hover-bg: rgba(248, 239, 232, 0.96);
    --theme-chip-text: #191514;
    --theme-muted-text: #5a4a43;
    --theme-accent-bg: #b83d2e;
    --theme-accent-text: #fffaf6;
    --theme-accent-hover: #a23326;
    --theme-brand-soft: #f1d2cc;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --theme-panel-bg: linear-gradient(180deg, rgba(38, 32, 29, 0.98), rgba(25, 21, 20, 0.96));
      --theme-panel-border: rgba(208, 106, 94, 0.2);
      --theme-panel-shadow: 0 34px 80px rgba(0, 0, 0, 0.54);
      --theme-elevated-bg: rgba(44, 36, 33, 0.88);
      --theme-elevated-border: rgba(64, 53, 48, 0.94);
      --theme-overlay-backdrop: rgba(25, 21, 20, 0.58);
      --theme-hover-bg: rgba(56, 47, 43, 0.92);
      --theme-chip-text: #f3ece4;
      --theme-muted-text: #c1afa3;
      --theme-accent-bg: #d06a5e;
      --theme-accent-text: #fff7f3;
      --theme-accent-hover: #de7e72;
      --theme-brand-soft: rgba(208, 106, 94, 0.22);
    }
  }

  .backdrop {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(circle at top, color-mix(in srgb, var(--theme-brand-soft) 68%, transparent), transparent 30%),
      var(--theme-overlay-backdrop);
    backdrop-filter: blur(10px);
    animation: fade-in 180ms ease;
  }

  .theme-overlay {
    background:
      radial-gradient(circle at top, color-mix(in srgb, var(--theme-brand-soft) 68%, transparent), transparent 30%),
      var(--theme-overlay-backdrop);
  }

  .viewport {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px 16px;
    box-sizing: border-box;
  }

  .popover {
    position: relative;
    width: min(480px, calc(100vw - 32px));
    max-height: min(640px, calc(100vh - 48px));
    overflow: auto;
    border: 1px solid var(--theme-panel-border);
    border-radius: 24px;
    background: var(--theme-panel-bg);
    box-shadow:
      var(--theme-panel-shadow),
      inset 0 1px 0 rgba(255, 253, 249, 0.82);
    color: var(--theme-chip-text);
    font-family: "SF Pro Text", "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.5;
    animation: pop-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .folio-site-popover {
    position: relative;
  }

  .theme-panel {
    border-color: var(--theme-panel-border);
    background: var(--theme-panel-bg);
    box-shadow:
      var(--theme-panel-shadow),
      inset 0 1px 0 rgba(255, 253, 249, 0.08);
    color: var(--theme-chip-text);
  }

  .theme-elevated {
    background: var(--theme-elevated-bg);
    border-color: var(--theme-elevated-border);
    color: var(--theme-chip-text);
  }

  .section {
    padding: 16px 20px;
  }

  .section + .section {
    border-top: 1px solid color-mix(in srgb, var(--theme-panel-border) 72%, transparent);
  }

  .hero {
    display: grid;
    gap: 14px;
    background:
      radial-gradient(circle at top left, color-mix(in srgb, var(--theme-brand-soft) 88%, transparent), transparent 42%),
      linear-gradient(180deg, rgba(255, 253, 249, 0.88), rgba(246, 240, 234, 0.82));
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
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at top, rgba(255, 253, 249, 0.94), rgba(244, 233, 224, 0.88));
    border: 1px solid color-mix(in srgb, var(--theme-panel-border) 92%, transparent);
    box-shadow:
      0 14px 28px rgba(58, 49, 45, 0.08),
      inset 0 1px 0 rgba(255, 253, 249, 0.8);
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
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--theme-muted-text);
    margin-bottom: 4px;
  }

  .headline {
    font-size: 22px;
    font-family: var(--theme-display-font);
    font-weight: 500;
    letter-spacing: -0.03em;
    line-height: 1.14;
    color: var(--theme-chip-text);
  }

  .subcopy {
    margin-top: 6px;
    color: var(--theme-muted-text);
    font-size: 13px;
  }

  .icon-button {
    appearance: none;
    width: 32px;
    height: 32px;
    flex: none;
    border: 1px solid color-mix(in srgb, var(--theme-elevated-border) 88%, transparent);
    border-radius: 999px;
    background: var(--theme-elevated-bg);
    color: var(--theme-chip-text);
    font: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    transition: transform 160ms ease, background 160ms ease;
  }

  .icon-button:hover {
    background: var(--theme-hover-bg);
    transform: translateY(-1px);
  }

  .icon-button:active {
    transform: scale(0.98);
  }

  .tweet-card {
    display: grid;
    gap: 8px;
    padding: 13px 15px;
    border-radius: 16px;
    background: var(--theme-elevated-bg);
    border: 1px solid var(--theme-elevated-border);
    box-shadow: inset 0 1px 0 rgba(255, 253, 249, 0.72);
  }

  .folio-site-tweet-card {
    position: relative;
  }

  .tweet-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: var(--theme-muted-text);
    font-size: 12px;
  }

  .tweet-author {
    color: var(--theme-chip-text);
    font-weight: 600;
  }

  .tweet-text {
    color: var(--theme-chip-text);
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
    margin-bottom: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--theme-muted-text);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag-option {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 180px;
    min-width: 64px;
    min-height: 32px;
    justify-content: center;
    padding: 5px 11px;
    border-radius: 10px;
    border: 1px solid var(--theme-elevated-border);
    background: var(--theme-elevated-bg);
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
    border-color: color-mix(in srgb, var(--theme-accent-bg) 24%, var(--theme-elevated-border));
  }

  .tag-option[data-selected="true"] {
    border-color: color-mix(in srgb, var(--theme-accent-bg) 32%, var(--theme-elevated-border));
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--theme-brand-soft) 32%, var(--theme-elevated-bg)), color-mix(in srgb, var(--theme-brand-soft) 72%, var(--theme-elevated-bg)));
    box-shadow:
      0 12px 26px rgba(184, 61, 46, 0.1),
      inset 0 1px 0 rgba(255, 253, 249, 0.82);
  }

  .tag-option:active {
    transform: scale(0.985);
  }

  .tag-name {
    min-width: 0;
    font-family: var(--theme-display-font);
    font-weight: 600;
    color: var(--theme-chip-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-state {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .empty,
  .status,
  .error {
    padding: 14px;
    border-radius: 14px;
    background: var(--theme-elevated-bg);
    border: 1px dashed var(--theme-elevated-border);
    color: var(--theme-muted-text);
  }

  .error {
    background: color-mix(in srgb, var(--theme-brand-soft) 44%, var(--theme-elevated-bg));
    border-color: color-mix(in srgb, var(--theme-accent-bg) 28%, transparent);
    color: var(--theme-accent-bg);
  }

  .button {
    appearance: none;
    border: 1px solid var(--theme-elevated-border);
    border-radius: 12px;
    background: var(--theme-elevated-bg);
    color: var(--theme-chip-text);
    font: inherit;
    font-weight: 500;
    min-height: 36px;
    padding: 8px 14px;
    cursor: pointer;
    transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
  }

  .button:hover {
    background: var(--theme-hover-bg);
    border-color: color-mix(in srgb, var(--theme-accent-bg) 24%, var(--theme-elevated-border));
    transform: translateY(-1px);
  }

  .button:active {
    transform: scale(0.98);
  }

  .button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .theme-button-primary {
    background: var(--theme-accent-bg);
    border-color: transparent;
    color: var(--theme-accent-text);
  }

  .theme-button-primary:hover {
    background: var(--theme-accent-hover);
    border-color: transparent;
  }

  .create-row {
    display: grid;
    gap: 8px;
  }

  .create-trigger-row {
    display: flex;
    justify-content: flex-start;
  }

  .create-input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--theme-elevated-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--theme-elevated-bg) 92%, #fffdf9);
    min-height: 40px;
    padding: 10px 14px;
    font: inherit;
    color: inherit;
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .create-input:focus {
    border-color: color-mix(in srgb, var(--theme-accent-bg) 34%, var(--theme-elevated-border));
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent-bg) 12%, transparent);
  }

  .create-actions {
    display: flex;
    gap: 8px;
  }

  .section-note {
    color: var(--theme-muted-text);
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
  private openRequestId = 0
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
    const requestId = this.openRequestId + 1
    this.openRequestId = requestId
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
      if (!this.isCurrentRequest(requestId)) {
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
      if (!this.isCurrentRequest(requestId)) {
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
    this.openRequestId += 1
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
      <style>${getPopoverStyle()}</style>
      <div class="backdrop theme-overlay" data-testid="site-tag-modal-backdrop"></div>
      <div class="viewport" data-testid="site-tag-popover-viewport">
        <div class="popover folio-site-popover theme-panel" data-testid="site-tag-popover" role="dialog" aria-modal="true"></div>
      </div>
    `

    this.document.body.appendChild(host)
    this.host = host
    this.shadowRootRef = shadowRootRef
  }

  private isCurrentRequest(requestId: number) {
    return this.isOpen && this.openRequestId === requestId
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
        <div class="tweet-card folio-site-tweet-card theme-elevated" data-testid="site-tag-tweet-card">
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
                            <label class="tag-option theme-elevated" data-selected="${this.state.selectedTagIds.includes(tag.id) ? "true" : "false"}">
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
                        <button class="button theme-button-primary" data-testid="site-tag-create-submit" data-variant="primary" ${this.state.saving ? "disabled" : ""}>${copy.createAction}</button>
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

function getPopoverStyle() {
  const regularFontUrl = resolveExtensionAssetUrl(WENKAI_REGULAR_PATH)
  const mediumFontUrl = resolveExtensionAssetUrl(WENKAI_MEDIUM_PATH)

  return `
  @font-face {
    font-family: "LXGW WenKai";
    src: url("${regularFontUrl}") format("woff2");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: "LXGW WenKai";
    src: url("${mediumFontUrl}") format("woff2");
    font-weight: 500;
    font-style: normal;
    font-display: swap;
  }

${POPOVER_STYLE}
`
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
