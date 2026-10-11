import { DEADLINE_EXCEEDED_ERROR, LlmError, REQUEST_TIMEOUT_ERROR, normalizeHttpError } from "../errors.ts"
import { requestChatJson, testLlmConnection } from "../../autotag/llmProvider.ts"
import type { AdapterContext, ChatApiAdapter, ChatJsonResult, DroppedOption } from "../types.ts"

const HTTP_ERROR_PATTERN = /^HTTP (\d{3})(?::\s*([\s\S]*))?$/

// The engine reports failures as strings (that is its long-standing contract).
// Map them back onto the shared taxonomy so every provider fails the same way.
function toLlmError(message: string): LlmError {
  if (message === DEADLINE_EXCEEDED_ERROR) {
    return new LlmError("timeout", message, { messageCarriesBody: true })
  }

  if (message === REQUEST_TIMEOUT_ERROR) {
    return new LlmError("timeout", message)
  }

  const match = HTTP_ERROR_PATTERN.exec(message)
  if (match) {
    return normalizeHttpError({ status: Number(match[1]), bodyText: match[2] ?? "" })
  }

  return new LlmError("network", message)
}

// OpenAI-compatible chat/completions. Both `openai` and the user's own
// OpenAI-compatible endpoint (`custom`, which also covers Ollama / LM Studio /
// vLLM) run through the single-provider engine that already existed, so this
// adapter adds capability handling and error typing without a second HTTP stack.
export const openAiChatAdapter: ChatApiAdapter = {
  id: "openai-chat",
  // Keyless is legitimate: a local server. Whether a key is *required* is decided
  // by the provider definition's credentialKind, not here.
  needsApiKey: false,

  async chatJson(request, context): Promise<ChatJsonResult> {
    const strategy = context.capabilities.jsonStrategy
    const wantsJson = strategy !== "prompt-only"
    const wantsSchema = strategy === "json-schema-strict" || strategy === "json-schema"
    // The engine pins temperature at 0 on purpose: tagging must be reproducible.
    const wantsTemperature = context.capabilities.temperature

    // The engine mutates this object in place when a gateway rejects a parameter,
    // which is exactly how we learn what it had to drop.
    const sendOptions = { jsonMode: wantsJson, temperature: wantsTemperature }
    const droppedOptions: DroppedOption[] = []

    // A capability the model does not have is a parameter this request will not
    // carry, whether or not the engine ever tried to send it.
    if (request.jsonSchema && !wantsSchema) {
      droppedOptions.push("jsonSchema")
    }

    if (request.temperature !== undefined && !wantsTemperature) {
      droppedOptions.push("temperature")
    }

    const result = await requestChatJson({
      settings: { baseUrl: context.baseUrl, model: request.model },
      apiKey: context.apiKey ?? "",
      prompt: request.user,
      systemPrompt: request.system,
      jsonSchema:
        wantsSchema && request.jsonSchema
          ? {
              name: request.schemaName ?? "emit_tags",
              strict: strategy === "json-schema-strict",
              schema: request.jsonSchema
            }
          : undefined,
      fetchImpl: context.fetchImpl,
      sleep: context.sleep,
      timeoutMs: context.timeoutMs,
      deadlineMs: request.deadlineMs,
      now: context.now,
      capabilities: sendOptions
    })

    if (!result.ok) {
      throw toLlmError(result.error ?? "request-failed")
    }

    // A parameter the engine dropped while probing is an option this request did
    // not carry, so it belongs in the report.
    if (wantsJson && !sendOptions.jsonMode && !droppedOptions.includes("jsonSchema")) {
      droppedOptions.push("jsonSchema")
    }

    if (wantsTemperature && !sendOptions.temperature && !droppedOptions.includes("temperature")) {
      droppedOptions.push("temperature")
    }

    return { text: result.content, droppedOptions }
  },

  async probe(context: AdapterContext) {
    const result = await testLlmConnection({
      settings: { baseUrl: context.baseUrl, model: "" },
      apiKey: context.apiKey ?? "",
      fetchImpl: context.fetchImpl,
      timeoutMs: context.timeoutMs
    })

    return result.ok ? { ok: true } : { ok: false, error: result.error ?? "request-failed" }
  }
}
