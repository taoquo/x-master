import { LlmError, sanitizeLlmError } from "../errors.ts"
import { joinUrl } from "../providers.ts"
import { probeJson, requestJson } from "../transport.ts"
import type { ChatApiAdapter, ChatJsonResult, DroppedOption } from "../types.ts"

interface AzureChatPayload {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

// Azure serves the OpenAI body but not the OpenAI routing: the deployment name is
// part of the path, the api version is a query parameter, and the credential goes
// in an `api-key` header instead of `Authorization`.
export const azureOpenAiChatAdapter: ChatApiAdapter = {
  id: "azure-openai-chat",
  needsApiKey: true,

  async chatJson(request, context): Promise<ChatJsonResult> {
    const deployment = (context.deploymentName ?? "").trim()
    if (!deployment) {
      // Fail before the network: a request without a deployment cannot succeed and
      // would come back as an unhelpful 404.
      throw new LlmError("bad-request", "An Azure deployment name is required")
    }

    const apiVersion = (context.apiVersion ?? "2024-10-21").trim()
    const url = `${joinUrl(context.baseUrl, `/openai/deployments/${encodeURIComponent(deployment)}/chat/completions`)}?api-version=${encodeURIComponent(apiVersion)}`
    const strategy = context.capabilities.jsonStrategy
    const droppedOptions: DroppedOption[] = []
    const wantsSchema = strategy === "json-schema-strict" || strategy === "json-schema"

    const buildBody = (): unknown => {
      const responseFormat =
        strategy === "prompt-only"
          ? undefined
          : wantsSchema && request.jsonSchema
            ? {
                type: "json_schema",
                json_schema: {
                  name: request.schemaName ?? "emit_tags",
                  strict: strategy === "json-schema-strict",
                  schema: request.jsonSchema
                }
              }
            : { type: "json_object" }

      if (strategy !== "prompt-only" && !responseFormat) {
        droppedOptions.push("jsonSchema")
      }

      const temperature = context.capabilities.temperature ? request.temperature : undefined
      if (request.temperature !== undefined && temperature === undefined) {
        droppedOptions.push("temperature")
      }

      return {
        model: request.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user }
        ],
        ...(responseFormat ? { response_format: responseFormat } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(request.maxOutputTokens !== undefined ? { max_tokens: request.maxOutputTokens } : {})
      }
    }

    try {
      const response = await requestJson({
        url,
        headers: { "content-type": "application/json", "api-key": context.apiKey ?? "" },
        buildBody,
        timeoutMs: context.timeoutMs,
        deadlineMs: request.deadlineMs,
        fetchImpl: context.fetchImpl,
        sleep: context.sleep,
        now: context.now
      })

      const payload = (response.payload ?? {}) as AzureChatPayload
      return {
        text: payload.choices?.[0]?.message?.content ?? "",
        usage: {
          inputTokens: payload.usage?.prompt_tokens,
          outputTokens: payload.usage?.completion_tokens
        },
        finishReason: payload.choices?.[0]?.finish_reason,
        droppedOptions: [...new Set(droppedOptions)]
      }
    } catch (error) {
      throw sanitizeLlmError(error, context.apiKey)
    }
  },

  async probe(context) {
    const apiVersion = (context.apiVersion ?? "2024-10-21").trim()
    const url = `${joinUrl(context.baseUrl, "/openai/models")}?api-version=${encodeURIComponent(apiVersion)}`

    try {
      return await probeJson({
        url,
        headers: { "api-key": context.apiKey ?? "" },
        timeoutMs: context.timeoutMs,
        fetchImpl: context.fetchImpl
      })
    } catch (error) {
      const sanitized = sanitizeLlmError(error, context.apiKey)
      return { ok: false, error: sanitized.message }
    }
  }
}
