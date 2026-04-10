import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { extractSiteTweetDraft } from "../../src/content/tweet-dom.ts"

test("extractSiteTweetDraft reads a standard x.com article", () => {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <article>
          <div data-testid="User-Name">
            <a href="/alice">
              <span>Alice Johnson</span>
            </a>
            <a href="/alice/status/1234567890">
              <time datetime="2026-04-01T12:00:00.000Z"></time>
            </a>
          </div>
          <div data-testid="tweetText">A ship-ready tweet body</div>
        </article>
      </body>
    </html>
  `)

  const article = dom.window.document.querySelector("article")
  const draft = extractSiteTweetDraft(article)

  assert.deepEqual(draft, {
    tweetId: "1234567890",
    tweetUrl: "https://x.com/alice/status/1234567890",
    authorName: "Alice Johnson",
    authorHandle: "alice",
    text: "A ship-ready tweet body",
    createdAtOnX: "2026-04-01T12:00:00.000Z"
  })
})

test("extractSiteTweetDraft returns null when the article lacks a status link", () => {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <article>
          <div data-testid="User-Name">
            <a href="/alice"><span>Alice</span></a>
          </div>
          <div data-testid="tweetText">Missing status anchor</div>
        </article>
      </body>
    </html>
  `)

  const article = dom.window.document.querySelector("article")

  assert.equal(extractSiteTweetDraft(article), null)
})
