import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AnthropicLlmClient, LlmRefusalError } from "../../../src/adapters/llm/anthropic-llm-client.js";
import { createLlmClient } from "../../../src/adapters/llm/llm-client-factory.js";

function fakeAnthropic(response: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          calls.push(params);
          return response;
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

describe("AnthropicLlmClient", () => {
  it("invia system, prompt e schema JSON e restituisce il testo", async () => {
    const { client, calls } = fakeAnthropic({
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "" },
        { type: "text", text: " ciao " },
      ],
    });
    const llm = new AnthropicLlmClient({ apiKey: "k", model: "m" }, client);

    const text = await llm.complete({ system: "S", prompt: "P", jsonSchema: { type: "object" } });

    expect(text).toBe("ciao");
    expect(calls[0]).toMatchObject({
      model: "m",
      system: "S",
      messages: [{ role: "user", content: "P" }],
      fallbacks: "default",
      output_config: { format: { type: "json_schema", schema: { type: "object" } } },
    });
  });

  it("segnala il rifiuto del modello", async () => {
    const { client } = fakeAnthropic({ stop_reason: "refusal", stop_details: { explanation: "x" }, content: [] });
    await expect(new AnthropicLlmClient({ apiKey: "k" }, client).complete({ system: "", prompt: "" })).rejects.toBeInstanceOf(
      LlmRefusalError,
    );
  });

  it("segnala la risposta troncata", async () => {
    const { client } = fakeAnthropic({ stop_reason: "max_tokens", content: [{ type: "text", text: "a" }] });
    await expect(new AnthropicLlmClient({ apiKey: "k" }, client).complete({ system: "", prompt: "" })).rejects.toThrow(
      /troncata/,
    );
  });
});

describe("createLlmClient", () => {
  it("usa Anthropic come default", () => {
    expect(createLlmClient({ ANTHROPIC_API_KEY: "k" })).toBeInstanceOf(AnthropicLlmClient);
  });

  it("richiede la chiave", () => {
    expect(() => createLlmClient({})).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("rifiuta fornitori sconosciuti", () => {
    expect(() => createLlmClient({ LLM_PROVIDER: "boh" })).toThrow(/non supportato/);
  });
});
