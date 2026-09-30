import type { LlmClient } from "../../ports/llm-client.js";
import { AnthropicLlmClient } from "./anthropic-llm-client.js";

type Env = Record<string, string | undefined>;
type LlmClientCreator = (env: Env) => LlmClient;

/**
 * Registro dei fornitori LLM (Strategy + Factory).
 * Per aggiungere Gemini: implementare LlmClient e registrarlo qui con la sua chiave.
 */
const providers: Record<string, LlmClientCreator> = {
  anthropic: (env) => {
    const apiKey = env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("Variabile d'ambiente mancante: ANTHROPIC_API_KEY");
    return new AnthropicLlmClient({
      apiKey,
      ...(env.LLM_MODEL ? { model: env.LLM_MODEL } : {}),
      ...(env.LLM_MAX_TOKENS ? { maxTokens: Number(env.LLM_MAX_TOKENS) } : {}),
    });
  },
};

export function createLlmClient(env: Env): LlmClient {
  const name = env.LLM_PROVIDER?.trim() || "anthropic";
  const create = providers[name];
  if (!create) throw new Error(`Fornitore LLM non supportato: ${name} (disponibili: ${Object.keys(providers).join(", ")})`);
  return create(env);
}
