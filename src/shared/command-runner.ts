import { spawn } from "node:child_process";

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  timeoutMs: number;
  /** Variabili da rimuovere dall'ambiente del processo figlio. */
  unsetEnv?: readonly string[];
}

/** Esecuzione di un processo esterno, astratta per poterla sostituire nei test. */
export interface CommandRunner {
  run(command: string, args: readonly string[], stdin: string, options: RunOptions): Promise<CommandResult>;
}

export class NodeCommandRunner implements CommandRunner {
  run(command: string, args: readonly string[], stdin: string, options: RunOptions): Promise<CommandResult> {
    const { timeoutMs } = options;
    const env = { ...process.env };
    for (const name of options.unsetEnv ?? []) delete env[name];
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], env });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`${command} non ha risposto entro ${timeoutMs / 1000}s`));
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`Impossibile avviare ${command}: ${error.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });
      child.stdin.end(stdin);
    });
  }
}
