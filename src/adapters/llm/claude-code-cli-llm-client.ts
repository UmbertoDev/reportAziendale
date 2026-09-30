import type { LlmClient, LlmRequest } from "../../ports/llm-client.js";
import { NodeCommandRunner, type CommandRunner } from "../../shared/command-runner.js";

export interface ClaudeCodeCliConfig {
  /** Eseguibile della CLI (default "claude"). */
  binary?: string;
  model?: string;
  timeoutMs?: number;
}

interface CliResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
}

/**
 * Adapter LOCAL: usa la CLI di Claude Code in modalità non interattiva,
 * autenticata con l'abbonamento (login locale o CLAUDE_CODE_OAUTH_TOKEN).
 * Nessuna chiave API: il consumo va sui limiti dell'abbonamento.
 */
export class ClaudeCodeCliLlmClient implements LlmClient {
  private readonly binary: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: ClaudeCodeCliConfig = {},
    private readonly runner: CommandRunner = new NodeCommandRunner(),
  ) {
    this.binary = config.binary ?? "claude";
    this.timeoutMs = config.timeoutMs ?? 10 * 60 * 1000;
  }

  async complete(request: LlmRequest): Promise<string> {
    const { exitCode, stdout, stderr } = await this.runner.run(
      this.binary,
      this.args(request),
      request.prompt,
      // Senza ANTHROPIC_API_KEY la CLI usa l'abbonamento (login o CLAUDE_CODE_OAUTH_TOKEN), mai la chiave a consumo.
      { timeoutMs: this.timeoutMs, unsetEnv: ["ANTHROPIC_API_KEY"] },
    );
    const output = parseOutput(stdout);
    if (exitCode !== 0 || !output || output.is_error || output.subtype !== "success") {
      const detail = output?.result ?? (stderr || stdout).trim().slice(0, 500);
      throw new Error(`Claude Code CLI fallita (exit ${exitCode}): ${detail || "nessun dettaglio"}`);
    }

    if (request.jsonSchema) {
      if (output.structured_output !== undefined) return JSON.stringify(output.structured_output);
    }
    const text = output.result?.trim();
    if (!text) throw new Error("Risposta vuota da Claude Code CLI");
    return text;
  }

  /** Sessione "pulita": niente strumenti, niente CLAUDE.md o memoria locale, niente sessione salvata. */
  private args(request: LlmRequest): string[] {
    return [
      "-p",
      "--safe-mode",
      "--output-format",
      "json",
      "--no-session-persistence",
      "--tools",
      "",
      "--system-prompt",
      request.system,
      ...(this.config.model ? ["--model", this.config.model] : []),
      ...(request.jsonSchema ? ["--json-schema", JSON.stringify(request.jsonSchema)] : []),
    ];
  }
}

function parseOutput(stdout: string): CliResult | null {
  try {
    return JSON.parse(stdout) as CliResult;
  } catch {
    return null;
  }
}
