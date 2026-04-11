import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { render } from "../../extension/tests/helpers/render.tsx"
import { LandingPage } from "../src/LandingPage.tsx"

function getLink(container: HTMLDivElement, label: string) {
  return Array.from(container.querySelectorAll("a")).find((link) =>
    link.textContent?.replace(/\s+/g, " ").includes(label)
  )
}

test("LandingPage renders the planned sections, primary CTAs, and sync-first story", () => {
  const { container } = render(React.createElement(LandingPage))

  assert.match(container.textContent ?? "", /Pull your X bookmarks into a searchable local workspace\./)
  assert.match(container.textContent ?? "", /Auto-tag new bookmarks with rules\./)
  assert.match(container.textContent ?? "", /Chrome extension/)
  assert.match(container.textContent ?? "", /Local-first bookmark workspace/)
  assert.match(container.textContent ?? "", /Sync from X/)
  assert.match(container.textContent ?? "", /Rules-based tagging/)
  assert.ok(container.querySelector('[data-testid="hero-section"]'))
  assert.ok(container.querySelector('[data-testid="trust-strip"]'))
  assert.ok(container.querySelector('[data-testid="features-section"]'))
  assert.ok(container.querySelector('[data-testid="workflow-section"]'))
  assert.ok(container.querySelector('[data-testid="install-section"]'))
  assert.ok(container.querySelector('[data-testid="faq-section"]'))

  const installLink = getLink(container, "Install Extension")
  const repoLink = getLink(container, "View on GitHub")

  assert.equal(installLink?.getAttribute("href"), "https://github.com/polokobe/x-master/releases")
  assert.equal(repoLink?.getAttribute("href"), "https://github.com/polokobe/x-master")
  assert.doesNotMatch(container.textContent ?? "", /Search your archive first/)
})

test("LandingPage includes reduced-motion protections in the page shell", () => {
  const { container } = render(React.createElement(LandingPage))
  const styleTag = container.querySelector("style")

  assert.ok(styleTag)
  assert.match(styleTag.textContent ?? "", /prefers-reduced-motion: reduce/)
  assert.match(styleTag.textContent ?? "", /animation: none !important/)
})
