import { describe, expect, it } from "vitest";
import { ClaudeCodeCliLlmClient } from "../../../src/adapters/llm/claude-code-cli-llm-client.js";
import type { CommandResult, CommandRunner, RunOptions } from "../../../src/shared/command-runner.js";

class FakeRunner implements CommandRunner {
  readonly calls: { command: string; args: readonly string[]; stdin: string; options: RunOptions }[] = [];

  constructor(private readonly result: CommandResult) {}

  async run(command: string, args: readonly string[], stdin: string, options: RunOptions): Promise<CommandResult> {
    this.calls.push({ command, args, stdin, options });
    return this.result;
  }
}

const ok = (body: Record<string, unknown>): CommandResult => ({
  exitCode: 0,
  stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, ...body }),
  stderr: "",
});

describe("ClaudeCodeCliLlmClient", () => {
  it("passa il prompt su stdin e il system prompt in una sessione pulita", async () => {
    const runner = new FakeRunner(ok({ result: " Recap " }));
    const llm = new ClaudeCodeCliLlmClient({ binary: "/opt/claude", model: "sonnet" }, runner);

    expect(await llm.complete({ system: "Istruzioni", prompt: "Diari" })).toBe("Recap");

    const call = runner.calls[0]!;
    expect(call.command).toBe("/opt/claude");
    expect(call.stdin).toBe("Diari");
    expect(call.args).toEqual(
      expect.arrayContaining(["-p", "--safe-mode", "--no-session-persistence", "--system-prompt", "Istruzioni"]),
    );
    expect(call.args.slice(call.args.indexOf("--tools"), call.args.indexOf("--tools") + 2)).toEqual(["--tools", ""]);
    expect(call.args.slice(-2)).toEqual(["--model", "sonnet"]);
    expect(call.options.unsetEnv).toEqual(["ANTHROPIC_API_KEY"]);
  });

  it("con schema JSON restituisce l'output strutturato", async () => {
    const runner = new FakeRunner(ok({ result: "testo", structured_output: { titolo: "T" } }));
    const schema = { type: "object" };
    const text = await new ClaudeCodeCliLlmClient({}, runner).complete({ system: "", prompt: "", jsonSchema: schema });

    expect(JSON.parse(text)).toEqual({ titolo: "T" });
    expect(runner.calls[0]!.args.slice(-2)).toEqual(["--json-schema", JSON.stringify(schema)]);
  });

  it("segnala l'errore riportato dalla CLI", async () => {
    const runner = new FakeRunner({
      exitCode: 1,
      stdout: JSON.stringify({ subtype: "error", is_error: true, result: "Not logged in" }),
      stderr: "",
    });
    await expect(new ClaudeCodeCliLlmClient({}, runner).complete({ system: "", prompt: "" })).rejects.toThrow(
      /Not logged in/,
    );
  });

  it("segnala un output non JSON", async () => {
    const runner = new FakeRunner({ exitCode: 127, stdout: "", stderr: "claude: command not found" });
    await expect(new ClaudeCodeCliLlmClient({}, runner).complete({ system: "", prompt: "" })).rejects.toThrow(
      /command not found/,
    );
  });
});
