import test from "node:test"
import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { constants as fsConstants } from "node:fs"
import path from "node:path"

test("extension stylesheet declares bundled LXGW WenKai font faces for Chinese UI", async () => {
  const css = await readFile(path.join(process.cwd(), "src", "styles", "extension.css"), "utf8")

  assert.match(css, /@font-face/)
  assert.match(css, /font-family:\s*"LXGW WenKai"/)
  assert.match(css, /assets\/fonts\/LXGWWenKai-Regular\.woff2/)
  assert.match(css, /assets\/fonts\/LXGWWenKai-Medium\.woff2/)
  assert.match(css, /:root\[lang="zh-CN"\]/)
  assert.match(css, /font-family:\s*"LXGW WenKai",\s*"PingFang SC"/)
  assert.doesNotMatch(css, /\.ttf/)
})

test("extension ships only bundled LXGW WenKai woff2 assets for runtime UI", async () => {
  const regularPath = path.join(process.cwd(), "assets", "fonts", "LXGWWenKai-Regular.woff2")
  const mediumPath = path.join(process.cwd(), "assets", "fonts", "LXGWWenKai-Medium.woff2")
  const legacyRegularTtfPath = path.join(process.cwd(), "assets", "fonts", "LXGWWenKai-Regular.ttf")
  const legacyMediumTtfPath = path.join(process.cwd(), "assets", "fonts", "LXGWWenKai-Medium.ttf")

  await access(regularPath, fsConstants.R_OK)
  await access(mediumPath, fsConstants.R_OK)

  await assert.rejects(() => access(legacyRegularTtfPath, fsConstants.F_OK))
  await assert.rejects(() => access(legacyMediumTtfPath, fsConstants.F_OK))
})

test("extension stylesheet keeps workspace chrome inside the Folio warm palette", async () => {
  const css = await readFile(path.join(process.cwd(), "src", "styles", "extension.css"), "utf8")

  assert.doesNotMatch(css, /rgba\(37,\s*99,\s*235/)
  assert.doesNotMatch(css, /rgba\(59,\s*130,\s*246/)
  assert.doesNotMatch(css, /#3b82f6/i)
  assert.doesNotMatch(css, /#22c55e/i)
  assert.doesNotMatch(css, /#93c5fd/i)
  assert.doesNotMatch(css, /#dbeafe/i)
  assert.doesNotMatch(css, /#f8fafc/i)
  assert.doesNotMatch(css, /\.text-slate-/)
  assert.doesNotMatch(css, /\.bg-slate-/)
})

test("extension stylesheet keeps detail tag input compact inline", async () => {
  const css = await readFile(path.join(process.cwd(), "src", "styles", "extension.css"), "utf8")

  assert.match(css, /\.options-detail-new-tag-input\s*\{[^}]*width:\s*clamp\(82px,\s*10vw,\s*116px\)/s)
  assert.match(css, /\.options-detail-new-tag-input\s*\{[^}]*height:\s*28px/s)
  assert.match(css, /\.options-detail-new-tag-input\s*\{[^}]*min-height:\s*28px/s)
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*\.options-detail-new-tag-input\s*\{[^}]*width:\s*clamp\(96px,\s*32vw,\s*136px\)/)
})

test("extension stylesheet keeps bookmark selection controls compact, subdued, and clear of avatars", async () => {
  const css = await readFile(path.join(process.cwd(), "src", "styles", "extension.css"), "utf8")
  const baseBlock = css.match(/\.options-bookmark-select-toggle\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ""
  const selectedBlock = css.match(/\.options-bookmark-select-toggle\.is-selected\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ""

  assert.match(baseBlock, /height:\s*20px/)
  assert.match(baseBlock, /width:\s*20px/)
  assert.match(baseBlock, /position:\s*absolute/)
  assert.match(css, /\.options-result-card:not\(\.options-result-card-has-top-media\)\s+\.options-card-main\s*\{[^}]*padding-left:\s*30px/s)
  assert.doesNotMatch(selectedBlock, /background:\s*var\(--accent-primary\)/)
  assert.doesNotMatch(selectedBlock, /0\s+0\s+0\s+3px/)
})
