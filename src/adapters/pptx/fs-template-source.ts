import { readFile } from "node:fs/promises";
import type { TemplateSource } from "../../ports/presentation.js";

export const DEFAULT_TEMPLATE_PATH = "templates/report-mensile.pptx";

export class FsTemplateSource implements TemplateSource {
  constructor(private readonly path: string = DEFAULT_TEMPLATE_PATH) {}

  async load(): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.path));
  }
}
