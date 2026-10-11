import { ANTHROPIC_VERSION } from "../providers.ts"
import { joinUrl } from "../providers.ts"
import { LlmError, sanitizeLlmError } from "../errors.ts"
import { probeJson, requestJson } from "../transport.ts"
import type { ChatApiAdapter, ChatJsonResult, DroppedOption } from "../types.ts"

const TOOL_NAME = "emit_tags"
// Anthropic requires max_tokens. Tagging answers are small, so a tight default
// keeps a runaway model from spending the run budget on one batch.
const DEFAULT_MAX_TOKENS = 1024

interface AnthropicContentBlock {
  type?: string
  text?: string
  name?: string
  input?: unknown
}

interface AnthropicPayload {
  content?: AnthropicContentBlock[]
  stop_reason?: string
  usage?: { input_tokens?: number; output_tokens?: number }
}

// Anthropic has no response_format, so JSON is requested through tool use and the
// answer arrives already parsed. `system` is a top-level field rather than a
// message, and a browser-origin request needs an explicit opt-in header.
export const anthropicMessagesAdapter: ChatApiAdapter = {
  id: "anthropic-messages",
  needsApiKey: true,

  async chatJson(request, context): Promise<ChatJsonResult> {
    const url = joinUrl(context.baseUrl, "/v1/messages")
    const strategy = context.capabilities.jsonStrategy
    const droppedOptions: DroppedOption[] = []
    const useTool = strategy === "tool" && request.jsonSchema !== undefined

    if (strategy === "prompt-only" || (strategy === "tool" && request.jsonSchema === undefined)) {
      droppedOptions.push("jsonSchema")
    }

    const temperature = context.capabilities.temperature ? request.temperature : undefined
    if (request.temperature !== undefined && temperature === undefined) {
      droppedOptions.push("temperature")
    }

    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      system: request.system,
      messages: [{ role: "user", content: [{ type: "text", text: request.user }] }],
      ...(temperature !== undefined ? { temperature } : {}),
      ...(useTool
        ? {
            tools: [{ name: TOOL_NAME, input_schema: request.jsonSchema }],
            tool_choice: { type: "tool", name: TOOL_NAME }
          }
        : {})
    }

    try {
      const response = await requestJson({
        url,
        headers: {
          "content-type": "application/json",
          "x-api-key": context.apiKey ?? "",
          "anthropic-version": ANTHROPIC_VERSION,
          // Anthropic refuses browser-origin requests unless the caller opts in.
          "anthropic-dangerous-direct-browser-access": "true",
          ...(context.extraHeaders ?? {})
        },
        body,
        timeoutMs: context.timeoutMs,
        deadlineMs: request.deadlineMs,
        fetchImpl: context.fetchImpl,
        sleep: context.sleep,
        now: context.now
      })

      const payload = (response.payload ?? {}) as AnthropicPayload
      const blocks = Array.isArray(payload.content) ? payload.content : []
      const toolUse = blocks.find((block) => block.type === "tool_use" && block.name === TOOL_NAME)
      const textBlocks = blocks
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("")

      if (useTool && !toolUse) {
        // The model refused to call the tool. A retry is worth one attempt, and the
        // orchestrator decides that from the error kind.
        throw new LlmError("invalid-json", "the model did not call the emit_tags tool")
      }

      return {
        text: toolUse ? JSON.stringify(toolUse.input ?? {}) : textBlocks,
        parsed: toolUse ? toolUse.input : undefined,
        usage: {
          inputTokens: payload.usage?.input_tokens,
          outputTokens: payload.usage?.output_tokens
        },
        finishReason: payload.stop_reason,
        droppedOptions: [...new Set(droppedOptions)]
      }
    } catch (error) {
      throw sanitizeLlmError(error, context.apiKey)
    }
  },

  async probe(context) {
    try {
      return await probeJson({
        url: joinUrl(context.baseUrl, "/v1/models"),
        headers: {
          "x-api-key": context.apiKey ?? "",
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true",
          ...(context.extraHeaders ?? {})
        },
        timeoutMs: context.timeoutMs,
        fetchImpl: context.fetchImpl
      })
    } catch (error) {
      return { ok: false, error: sanitizeLlmError(error, context.apiKey).message }
    }
  }
}
