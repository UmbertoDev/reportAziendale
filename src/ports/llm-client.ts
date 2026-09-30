export interface LlmRequest {
  system: string;
  prompt: string;
  /** Se presente, la risposta deve essere un JSON conforme a questo JSON Schema. */
  jsonSchema?: Record<string, unknown>;
}

/** Porta verso il modello linguistico: Anthropic, Gemini, ecc. sono adapter intercambiabili. */
export interface LlmClient {
  complete(request: LlmRequest): Promise<string>;
}
