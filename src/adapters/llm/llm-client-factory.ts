import type { LlmClient } from "../../ports/llm-client.js";
import { AnthropicLlmClient } from "./anthropic-llm-client.js";
import { ClaudeCodeCliLlmClient } from "./claude-code-cli-llm-client.js";

type Env = Record<string, string | undefined>;
type LlmClientCreator = (env: Env) => LlmClient;

const createLocal: LlmClientCreator = (env) =>
  new ClaudeCodeCliLlmClient({
    ...(env.CLAUDE_BIN ? { binary: env.CLAUDE_BIN } : {}),
    ...(env.LLM_MODEL ? { model: env.LLM_MODEL } : {}),
  });

const createApiKey: LlmClientCreator = (env) => {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("Variabile d'ambiente mancante: ANTHROPIC_API_KEY (richiesta con LLM_PROVIDER=API_KEY)");
  return new AnthropicLlmClient({
    apiKey,
    ...(env.LLM_MODEL ? { model: env.LLM_MODEL } : {}),
    ...(env.LLM_MAX_TOKENS ? { maxTokens: Number(env.LLM_MAX_TOKENS) } : {}),
  });
};

/**
 * Registro dei fornitori LLM (Strategy + Factory), scelto con LLM_PROVIDER:
 * - LOCAL (default, anche se vuoto): Claude Code CLI con l'abbonamento, nessuna chiave API
 * - API_KEY: API Anthropic a consumo con ANTHROPIC_API_KEY
 * Per aggiungere Gemini: implementare LlmClient e registrarlo qui.
 */
const providers: Record<string, LlmClientCreator> = {
  local: createLocal,
  "claude-code": createLocal,
  api_key: createApiKey,
  anthropic: createApiKey,
};

export const DEFAULT_LLM_PROVIDER = "local";

export function createLlmClient(env: Env): LlmClient {
  const name = env.LLM_PROVIDER?.trim().toLowerCase() || DEFAULT_LLM_PROVIDER;
  const create = providers[name];
  if (!create) {
    throw new Error(`Fornitore LLM non supportato: ${name} (disponibili: LOCAL, API_KEY)`);
  }
  return create(env);
}
