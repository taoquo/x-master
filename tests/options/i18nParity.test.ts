import test from "node:test"
import assert from "node:assert/strict"
import { getOptionsCopy } from "../../src/options/i18n/copy.ts"

// The repo had no key-parity guard: zh/en were only ever compared by hand. Both
// locales are hand-maintained literal objects, so nothing but a test keeps them
// from drifting.
test("zh-CN and en expose exactly the same keys", () => {
  const zh = Object.keys(getOptionsCopy("zh-CN")).sort()
  const en = Object.keys(getOptionsCopy("en")).sort()

  assert.deepEqual(zh.filter((key) => !en.includes(key)), [], "keys missing from en")
  assert.deepEqual(en.filter((key) => !zh.includes(key)), [], "keys missing from zh-CN")
  assert.ok(zh.length > 200, "the options copy should still be a full table")
})

test("no locale ships an empty string", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const blanks = Object.entries(getOptionsCopy(locale))
      .filter(([, value]) => typeof value === "string" && value.trim() === "")
      .map(([key]) => key)

    assert.deepEqual(blanks, [], `${locale} has blank copy`)
  }
})

test("the provider, capability and error copy exists in both locales", () => {
  const required = [
    "settingsLlmProvider",
    "settingsLlmProviderOpenai",
    "settingsLlmProviderAnthropic",
    "settingsLlmProviderGoogle",
    "settingsLlmProviderAzure",
    "settingsLlmProviderCustom",
    "settingsLlmBaseUrlRequired",
    "settingsLlmBaseUrlInvalid",
    "settingsLlmDeployment",
    "settingsLlmApiVersion",
    "settingsLlmApiKeyGet",
    "settingsLlmApiKeyNotNeeded",
    "settingsLlmTestResultOk",
    "settingsLlmTestDropped",
    "settingsLlmStrategyStrictSchema",
    "settingsLlmStrategyPromptOnly",
    "settingsLlmErrorUnauthorized",
    "settingsLlmErrorRateLimitLong",
    "settingsLlmErrorInvalidJson"
  ] as const

  for (const locale of ["zh-CN", "en"] as const) {
    const copy = getOptionsCopy(locale) as unknown as Record<string, string>
    for (const key of required) {
      assert.equal(typeof copy[key], "string", `${locale} is missing ${key}`)
      assert.ok(copy[key].length > 0, `${locale}.${key} is blank`)
    }
  }
})
