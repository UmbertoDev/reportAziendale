import { YearMonth } from "./year-month.js";

export type RecapStatus = "proposto" | "confermato";

export interface RecapIntegration {
  readonly at: string;
  readonly text: string;
}

const INTEGRATIONS_HEADING = "## Integrazioni della persona";

/**
 * Recap mensile di un venditore, salvato come Markdown con front matter.
 * Immutabile: ogni transizione restituisce una nuova istanza.
 */
export class MonthlyRecap {
  private constructor(
    readonly personSlug: string,
    readonly month: YearMonth,
    readonly status: RecapStatus,
    readonly updatedAt: string,
    readonly body: string,
    readonly integrations: readonly RecapIntegration[],
  ) {}

  static propose(personSlug: string, month: YearMonth, body: string, at: Date): MonthlyRecap {
    return new MonthlyRecap(personSlug, month, "proposto", at.toISOString(), body.trim(), []);
  }

  get isConfirmed(): boolean {
    return this.status === "confermato";
  }

  confirm(at: Date): MonthlyRecap {
    return new MonthlyRecap(this.personSlug, this.month, "confermato", at.toISOString(), this.body, this.integrations);
  }

  /** L'integrazione della persona vale anche come conferma. */
  integrate(text: string, at: Date): MonthlyRecap {
    const integration = { at: at.toISOString(), text: text.trim() };
    return new MonthlyRecap(this.personSlug, this.month, "confermato", integration.at, this.body, [
      ...this.integrations,
      integration,
    ]);
  }

  /** Testo completo (recap + integrazioni) da usare come fonte per il report. */
  get fullText(): string {
    if (this.integrations.length === 0) return this.body;
    const notes = this.integrations.map((i) => `- ${i.text}`).join("\n");
    return `${this.body}\n\nIntegrazioni del venditore:\n${notes}`;
  }

  serialize(): string {
    const frontMatter = [
      "---",
      `persona: ${this.personSlug}`,
      `mese: ${this.month}`,
      `stato: ${this.status}`,
      `aggiornato: ${this.updatedAt}`,
      "---",
    ].join("\n");
    const integrations = this.integrations.length
      ? `\n\n${INTEGRATIONS_HEADING}\n\n${this.integrations.map((i) => `### ${i.at}\n\n${i.text}`).join("\n\n")}`
      : "";
    return `${frontMatter}\n\n${this.body}${integrations}\n`;
  }

  static parse(markdown: string): MonthlyRecap {
    const match = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/.exec(markdown);
    if (!match) throw new Error("Recap senza front matter");
    const meta = Object.fromEntries(
      match[1]!.split("\n").map((line) => {
        const idx = line.indexOf(":");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      }),
    );
    const status = meta.stato;
    if (status !== "proposto" && status !== "confermato") throw new Error(`Stato recap non valido: ${status}`);

    const [body, integrationsBlock] = match[2]!.split(`\n\n${INTEGRATIONS_HEADING}\n\n`);
    const integrations = (integrationsBlock ?? "")
      .split(/^### /m)
      .filter((chunk) => chunk.trim())
      .map((chunk) => {
        const [at, ...rest] = chunk.split("\n");
        return { at: at!.trim(), text: rest.join("\n").trim() };
      });

    return new MonthlyRecap(
      String(meta.persona),
      YearMonth.parse(String(meta.mese)),
      status,
      String(meta.aggiornato),
      body!.trim(),
      integrations,
    );
  }
}
