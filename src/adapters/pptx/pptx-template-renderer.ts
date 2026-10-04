import JSZip from "jszip";
import type { PresentationRenderer } from "../../ports/presentation.js";

const SLIDE_FILE = /^ppt\/slides\/slide\d+\.xml$/;
const PARAGRAPH = /<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g;
const RUN = /<a:r>[\s\S]*?<\/a:r>/g;
const RUN_TEXT = /(<a:t(?:\s[^>]*)?>)([\s\S]*?)(<\/a:t>)/;
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Riempie i segnaposto {{nome}} nelle slide di un PPTX preconfigurato.
 * Deterministico: l'LLM fornisce solo i testi, il layout resta quello del template.
 *
 * - Un segnaposto spezzato su più "run" da PowerPoint viene ricomposto.
 * - Un valore su più righe, se il paragrafo contiene solo il segnaposto,
 *   diventa più paragrafi con la stessa formattazione (utile per gli elenchi puntati).
 */
export class PptxTemplateRenderer implements PresentationRenderer {
  async placeholders(template: Uint8Array): Promise<string[]> {
    const names = new Set<string>();
    for (const xml of Object.values(await this.readSlides(await JSZip.loadAsync(template)))) {
      for (const paragraph of xml.match(PARAGRAPH) ?? []) {
        for (const match of paragraphText(mergeRuns(paragraph)).matchAll(PLACEHOLDER)) names.add(match[1]!);
      }
    }
    return [...names];
  }

  async render(template: Uint8Array, values: Readonly<Record<string, string>>): Promise<Uint8Array> {
    const zip = await JSZip.loadAsync(template);
    for (const [path, xml] of Object.entries(await this.readSlides(zip))) {
      zip.file(path, xml.replace(PARAGRAPH, (paragraph) => renderParagraph(mergeRuns(paragraph), values)));
    }
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }

  private async readSlides(zip: JSZip): Promise<Record<string, string>> {
    const entries = Object.keys(zip.files).filter((p) => SLIDE_FILE.test(p));
    const contents = await Promise.all(entries.map((p) => zip.file(p)!.async("string")));
    return Object.fromEntries(entries.map((p, i) => [p, contents[i]!]));
  }
}

function paragraphText(paragraph: string): string {
  return (paragraph.match(RUN) ?? []).map((run) => RUN_TEXT.exec(run)?.[2] ?? "").join("");
}

/** Se un segnaposto è spezzato tra più run, sposta tutto il testo del paragrafo nel primo run. */
function mergeRuns(paragraph: string): string {
  const runs = paragraph.match(RUN) ?? [];
  if (runs.length < 2) return paragraph;
  const text = paragraphText(paragraph);
  const whole = countPlaceholders(text);
  const perRun = runs.reduce((sum, run) => sum + countPlaceholders(RUN_TEXT.exec(run)?.[2] ?? ""), 0);
  if (whole === perRun) return paragraph;

  let first = true;
  return paragraph.replace(RUN, (run) => {
    if (!first) return "";
    first = false;
    return run.replace(RUN_TEXT, (_m, open: string, _t: string, close: string) => `${open}${text}${close}`);
  });
}

const countPlaceholders = (text: string): number => [...text.matchAll(PLACEHOLDER)].length;

function renderParagraph(paragraph: string, values: Readonly<Record<string, string>>): string {
  const text = paragraphText(paragraph);
  const matches = [...text.matchAll(PLACEHOLDER)];
  if (matches.length === 0) return paragraph;

  const only = matches.length === 1 && text.trim() === matches[0]![0];
  const value = values[matches[0]![1]!] ?? "";
  if (only && value.includes("\n")) {
    return value
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => replaceInRuns(paragraph, () => escapeXml(line.trim())))
      .join("");
  }
  return replaceInRuns(paragraph, (name) => escapeXml((values[name] ?? "").replace(/\s*\n\s*/g, " ")));
}

function replaceInRuns(paragraph: string, valueOf: (name: string) => string): string {
  return paragraph.replace(RUN, (run) =>
    run.replace(RUN_TEXT, (_m, open: string, text: string, close: string) =>
      `${open}${text.replace(PLACEHOLDER, (_p, name: string) => valueOf(name))}${close}`,
    ),
  );
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
