import { LlmError, sanitizeLlmError } from "../errors.ts"
import { joinUrl } from "../providers.ts"
import { probeJson, requestJson } from "../transport.ts"
import type { ChatApiAdapter, ChatJsonResult, DroppedOption } from "../types.ts"

interface GeminiPayload {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
}

// Gemini takes the key as a query parameter, the system prompt as its own field,
// and asks for JSON through generationConfig rather than response_format.
export const googleGenerativeAiAdapter: ChatApiAdapter = {
  id: "google-generative-ai",
  needsApiKey: true,

  async chatJson(request, context): Promise<ChatJsonResult> {
    const model = request.model.trim()
    if (!model) {
      throw new LlmError("bad-request", "A model id is required")
    }

    const key = context.apiKey ?? ""
    const url = `${joinUrl(context.baseUrl, "/v1beta/models")}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
    const strategy = context.capabilities.jsonStrategy
    const droppedOptions: DroppedOption[] = []

    if (strategy === "prompt-only") {
      droppedOptions.push("jsonSchema")
    }

    const temperature = context.capabilities.temperature ? request.temperature : undefined
    if (request.temperature !== undefined && temperature === undefined) {
      droppedOptions.push("temperature")
    }

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.user }] }],
      generationConfig: {
        ...(strategy === "prompt-only" ? {} : { responseMimeType: "application/json" }),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(request.maxOutputTokens !== undefined ? { maxOutputTokens: request.maxOutputTokens } : {})
      }
    }

    try {
      const response = await requestJson({
        url,
        headers: { "content-type": "application/json" },
        body,
        timeoutMs: context.timeoutMs,
        deadlineMs: request.deadlineMs,
        fetchImpl: context.fetchImpl,
        sleep: context.sleep,
        now: context.now
      })

      const payload = (response.payload ?? {}) as GeminiPayload
      const candidate = payload.candidates?.[0]
      const text = (candidate?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("")

      return {
        text,
        usage: {
          inputTokens: payload.usageMetadata?.promptTokenCount,
          outputTokens: payload.usageMetadata?.candidatesTokenCount
        },
        finishReason: candidate?.finishReason,
        droppedOptions: [...new Set(droppedOptions)]
      }
    } catch (error) {
      // The key is in the URL, and a fetch failure quotes the URL it failed on.
      throw sanitizeLlmError(error, key)
    }
  },

  async probe(context) {
    const key = context.apiKey ?? ""

    try {
      return await probeJson({
        url: `${joinUrl(context.baseUrl, "/v1beta/models")}?key=${encodeURIComponent(key)}`,
        timeoutMs: context.timeoutMs,
        fetchImpl: context.fetchImpl
      })
    } catch (error) {
      return { ok: false, error: sanitizeLlmError(error, key).message }
    }
  }
}
