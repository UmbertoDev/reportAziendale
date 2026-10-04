import { DataLayout } from "../domain/data-layout.js";
import type { Person } from "../domain/person.js";
import { MonthlyRecap } from "../domain/recap.js";
import type { YearMonth } from "../domain/year-month.js";
import type { Clock } from "../ports/clock.js";
import { ContextDocuments, type ContextRepository } from "../ports/context-repository.js";
import type { FileStore } from "../ports/file-store.js";
import type { LlmClient } from "../ports/llm-client.js";
import type { PeopleDirectory } from "../ports/people-directory.js";
import type { DiaryReader } from "./diary-reader.js";

export type RecapOutcome =
  | { person: string; status: "generated"; recap: MonthlyRecap }
  | { person: string; status: "skipped"; reason: "no-diary" | "already-exists" }
  | { person: string; status: "failed"; error: string };

/** Hook per le azioni successive alla generazione (es. notifica Telegram). */
export interface RecapGeneratedListener {
  onRecapGenerated(person: Person, recap: MonthlyRecap): Promise<void>;
}

/** Caso d'uso: per ogni venditore genera il recap del mese dai suoi diari. */
export class GenerateMonthlyRecap {
  constructor(
    private readonly people: PeopleDirectory,
    private readonly diaries: DiaryReader,
    private readonly store: FileStore,
    private readonly context: ContextRepository,
    private readonly llm: LlmClient,
    private readonly clock: Clock,
    private readonly listeners: readonly RecapGeneratedListener[] = [],
  ) {}

  async execute(month: YearMonth, options: { overwrite?: boolean } = {}): Promise<RecapOutcome[]> {
    const outcomes: RecapOutcome[] = [];
    for (const person of await this.people.all()) {
      outcomes.push(await this.forPerson(person, month, options.overwrite ?? false));
    }
    return outcomes;
  }

  private async forPerson(person: Person, month: YearMonth, overwrite: boolean): Promise<RecapOutcome> {
    try {
      const path = DataLayout.recapFile(month, person);
      if (!overwrite && (await this.store.readText(path)) !== null) {
        return { person: person.slug, status: "skipped", reason: "already-exists" };
      }
      const diary = await this.diaries.monthOf(person, month);
      if (!diary) return { person: person.slug, status: "skipped", reason: "no-diary" };

      const body = await this.llm.complete({
        system: await this.systemPrompt(),
        prompt: `Venditore: ${person.name}\nMese: ${month}\n\n<diari>\n${diary}\n</diari>`,
      });
      const recap = MonthlyRecap.propose(person.slug, month, body, this.clock.now());
      await this.store.updateText(path, () => recap.serialize(), `recap: proposta ${person.slug} ${month}`);

      for (const listener of this.listeners) await listener.onRecapGenerated(person, recap);
      return { person: person.slug, status: "generated", recap };
    } catch (error) {
      return { person: person.slug, status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async systemPrompt(): Promise<string> {
    const [company, instructions] = await Promise.all([
      this.context.read(ContextDocuments.company),
      this.context.read(ContextDocuments.recapInstructions),
    ]);
    return `${instructions}\n\n<contesto_aziendale>\n${company}\n</contesto_aziendale>`;
  }
}
