import { invalidJsonError } from "./errors.ts"
import type { JsonStrategy } from "./types.ts"

// Strict JSON-schema mode (OpenAI's `strict: true`) supports only a small subset
// of JSON Schema. The keyword list and the rewrite rules below follow what the
// hosted endpoints accept; a schema that uses anything else must be rejected
// rather than sent, because the provider answers such a request with an opaque
// 400 that names nothing.
//
// The approach is modelled on `makeStrictJsonSchema` from @earendil-works/pi-ai
// (MIT, (c) Mario Zechner); this implementation is ours and is covered by our own
// tests.
const UNSUPPORTED_KEYWORDS = [
  "$ref",
  "$defs",
  "definitions",
  "allOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "patternProperties",
  "dependentSchemas",
  "dependencies",
  "unevaluatedProperties",
  "propertyNames",
  "contains",
  "prefixItems"
] as const

// Exported on purpose: the caller's require/prefer policy needs to tell "this
// schema cannot be made strict" apart from every other failure. (The library this
// is modelled on keeps its equivalent private, which forces string matching.)
export class UnsupportedSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsupportedSchemaError"
  }
}

export function isUnsupportedSchemaError(error: unknown): error is UnsupportedSchemaError {
  return error instanceof UnsupportedSchemaError
}

function cloneSchema(value: unknown): unknown {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as unknown
}

function walkSchema(node: unknown, path: string): Record<string, unknown> {
  if (typeof node === "boolean") {
    throw new UnsupportedSchemaError(`${path}: boolean schemas are not supported in strict mode`)
  }

  if (Array.isArray(node) || typeof node !== "object" || node === null) {
    throw new UnsupportedSchemaError(`${path}: expected an object schema`)
  }

  const schema = node as Record<string, unknown>

  for (const keyword of UNSUPPORTED_KEYWORDS) {
    if (keyword in schema) {
      throw new UnsupportedSchemaError(`${path}.${keyword} is not supported in strict mode`)
    }
  }

  const result: Record<string, unknown> = { ...schema }

  if ("items" in result) {
    if (Array.isArray(result.items)) {
      throw new UnsupportedSchemaError(`${path}.items: the tuple form is not supported in strict mode`)
    }

    result.items = walkSchema(result.items, `${path}.items`)
  }

  const properties = result.properties
  if (properties !== undefined || result.type === "object") {
    if (properties !== undefined && (Array.isArray(properties) || typeof properties !== "object" || properties === null)) {
      throw new UnsupportedSchemaError(`${path}.properties: expected an object`)
    }

    const entries = Object.entries((properties ?? {}) as Record<string, unknown>)
    const requiredNames = new Set(
      Array.isArray(result.required) ? result.required.filter((name): name is string => typeof name === "string") : []
    )

    const nextProperties: Record<string, unknown> = {}
    for (const [name, propertySchema] of entries) {
      const walked = walkSchema(propertySchema, `${path}.properties.${name}`)
      // Strict mode requires every property to be listed as required, so an
      // optional property is expressed as "this value or null" instead.
      nextProperties[name] = requiredNames.has(name) ? walked : { anyOf: [walked, { type: "null" }] }
    }

    result.type = "object"
    result.properties = nextProperties
    result.required = entries.map(([name]) => name)
    result.additionalProperties = false
  }

  return result
}

export function toStrictJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const cloned = cloneSchema(schema)
  return walkSchema(cloned, "$")
}

const DEGRADATION: Record<JsonStrategy, JsonStrategy[]> = {
  "json-schema-strict": ["json-schema", "json-object", "prompt-only"],
  "json-schema": ["json-object", "prompt-only"],
  "json-object": ["prompt-only"],
  tool: ["prompt-only"],
  "prompt-only": []
}

export function degradeStrategy(strategy: JsonStrategy, steps = 1): JsonStrategy {
  let current = strategy
  for (let index = 0; index < steps; index += 1) {
    const next = DEGRADATION[current][0]
    if (!next) {
      return current
    }
    current = next
  }
  return current
}

export const JSON_STRATEGY_LABELS: Record<JsonStrategy, string> = {
  "json-schema-strict": "JSON schema (strict)",
  "json-schema": "JSON schema",
  "json-object": "JSON object",
  tool: "tool call",
  "prompt-only": "prompt only"
}

// Providers behind compatible gateways do not all honour response_format, so a
// valid answer can arrive fenced in markdown, prefixed with prose, or as a bare
// array. Recover the payload instead of reporting nothing.
export function extractJsonCandidates(content: string): string[] {
  const trimmed = (content ?? "").trim()
  if (!trimmed) {
    return []
  }

  const candidates = [trimmed]
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim())
  }

  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"]
  ] as const) {
    const start = trimmed.indexOf(open)
    const end = trimmed.lastIndexOf(close)
    if (start >= 0 && end > start) {
      candidates.push(trimmed.slice(start, end + 1))
    }
  }

  return candidates
}

export function parseJsonLoose(content: string): unknown {
  for (const candidate of extractJsonCandidates(content)) {
    try {
      return JSON.parse(candidate)
    } catch {
      continue
    }
  }

  throw invalidJsonError()
}
