import Anthropic from "@anthropic-ai/sdk";
import type { LlmClient, LlmRequest } from "../../ports/llm-client.js";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export interface AnthropicLlmConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class LlmRefusalError extends Error {
  constructor(detail: string) {
    super(`Il modello ha rifiutato la richiesta: ${detail}`);
    this.name = "LlmRefusalError";
  }
}

/** Adapter Anthropic Messages API (con fallback lato server in caso di rifiuto). */
export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicLlmConfig, client?: Anthropic) {
    this.client = client ?? new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.maxTokens = config.maxTokens ?? 16000;
  }

  async complete(request: LlmRequest): Promise<string> {
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
      output_config: {
        effort: "high",
        ...(request.jsonSchema ? { format: { type: "json_schema", schema: request.jsonSchema } } : {}),
      },
    });

    if (response.stop_reason === "refusal") {
      throw new LlmRefusalError(response.stop_details?.explanation ?? "nessun dettaglio");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("Risposta troncata: aumentare LLM_MAX_TOKENS");
    }
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!text) throw new Error("Risposta vuota dal modello");
    return text;
  }
}
