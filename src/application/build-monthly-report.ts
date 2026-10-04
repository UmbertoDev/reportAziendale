import { z } from "zod";
import { DataLayout } from "../domain/data-layout.js";
import type { Person } from "../domain/person.js";
import { MonthlyRecap } from "../domain/recap.js";
import type { YearMonth } from "../domain/year-month.js";
import { ContextDocuments, type ContextRepository } from "../ports/context-repository.js";
import type { FileStore } from "../ports/file-store.js";
import type { LlmClient } from "../ports/llm-client.js";
import type { PeopleDirectory } from "../ports/people-directory.js";
import type { PresentationRenderer, TemplateSource } from "../ports/presentation.js";
import type { DiaryReader } from "./diary-reader.js";

export type ReportOutcome =
  | { person: string; status: "generated"; path: string; recapConfirmed: boolean }
  | { person: string; status: "skipped"; reason: "no-recap" }
  | { person: string; status: "failed"; error: string };

/** Segnaposto riempiti dal codice; tutti gli altri li compila l'LLM. */
export const SYSTEM_PLACEHOLDERS = ["mese", "venditore", "stato_recap"] as const;

export const RecapStatusLabel = {
  confirmed: "confermato dal venditore",
  unconfirmed: "NON confermato dal venditore",
} as const;

/** Caso d'uso: a fine mese produce il PPT di ogni venditore dal template preconfigurato. */
export class BuildMonthlyReport {
  constructor(
    private readonly people: PeopleDirectory,
    private readonly diaries: DiaryReader,
    private readonly store: FileStore,
    private readonly context: ContextRepository,
    private readonly llm: LlmClient,
    private readonly templateSource: TemplateSource,
    private readonly renderer: PresentationRenderer,
  ) {}

  async execute(month: YearMonth): Promise<ReportOutcome[]> {
    const template = await this.templateSource.load();
    const llmFields = (await this.renderer.placeholders(template)).filter(
      (name) => !(SYSTEM_PLACEHOLDERS as readonly string[]).includes(name),
    );
    const system = await this.systemPrompt();

    const outcomes: ReportOutcome[] = [];
    for (const person of await this.people.all()) {
      outcomes.push(await this.forPerson(person, month, { template, llmFields, system }));
    }
    return outcomes;
  }

  private async forPerson(
    person: Person,
    month: YearMonth,
    job: { template: Uint8Array; llmFields: string[]; system: string },
  ): Promise<ReportOutcome> {
    try {
      const recapText = await this.store.readText(DataLayout.recapFile(month, person));
      if (recapText === null) return { person: person.slug, status: "skipped", reason: "no-recap" };
      const recap = MonthlyRecap.parse(recapText);

      const content = await this.generateContent(person, month, recap, job.llmFields, job.system);
      const values = { ...content, ...this.systemValues(person, month, recap) };
      const path = DataLayout.reportFile(month, person);
      await this.store.writeBinary(path, await this.renderer.render(job.template, values), `report: ${person.slug} ${month}`);

      return { person: person.slug, status: "generated", path, recapConfirmed: recap.isConfirmed };
    } catch (error) {
      return { person: person.slug, status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async generateContent(
    person: Person,
    month: YearMonth,
    recap: MonthlyRecap,
    fields: string[],
    system: string,
  ): Promise<Record<string, string>> {
    if (fields.length === 0) return {};
    const diary = await this.diaries.monthOf(person, month);
    const raw = await this.llm.complete({
      system,
      prompt: [
        `Venditore: ${person.name}`,
        `Mese: ${month}`,
        `Segnaposto da compilare: ${fields.join(", ")}`,
        `<recap stato="${recap.status}">\n${recap.fullText}\n</recap>`,
        `<diari>\n${diary}\n</diari>`,
      ].join("\n\n"),
      jsonSchema: contentJsonSchema(fields),
    });
    return contentSchema(fields).parse(JSON.parse(raw));
  }

  private systemValues(person: Person, month: YearMonth, recap: MonthlyRecap): Record<string, string> {
    return {
      mese: monthLabel(month),
      venditore: person.name,
      stato_recap: recap.isConfirmed ? RecapStatusLabel.confirmed : RecapStatusLabel.unconfirmed,
    };
  }

  private async systemPrompt(): Promise<string> {
    const [company, instructions] = await Promise.all([
      this.context.read(ContextDocuments.company),
      this.context.read(ContextDocuments.reportInstructions),
    ]);
    return `${instructions}\n\n<contesto_aziendale>\n${company}\n</contesto_aziendale>`;
  }
}

export function contentJsonSchema(fields: string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: Object.fromEntries(fields.map((f) => [f, { type: "string" }])),
    required: fields,
    additionalProperties: false,
  };
}

const contentSchema = (fields: string[]) =>
  z.strictObject(Object.fromEntries(fields.map((f) => [f, z.string()])) as Record<string, z.ZodString>);

export function monthLabel(month: YearMonth): string {
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(month.year, month.month - 1, 15)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}
