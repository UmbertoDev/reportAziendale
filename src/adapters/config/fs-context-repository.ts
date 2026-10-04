import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ContextRepository } from "../../ports/context-repository.js";

/** Legge i file di contesto dalla cartella `context/` del checkout (solo job Node). */
export class FsContextRepository implements ContextRepository {
  constructor(private readonly dir: string) {}

  async read(name: string): Promise<string> {
    try {
      return (await readFile(join(this.dir, name), "utf8")).trim();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    }
  }
}
