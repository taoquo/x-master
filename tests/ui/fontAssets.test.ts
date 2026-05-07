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
