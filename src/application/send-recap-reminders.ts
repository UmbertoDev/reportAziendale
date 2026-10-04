import { DataLayout } from "../domain/data-layout.js";
import { MonthlyRecap } from "../domain/recap.js";
import type { YearMonth } from "../domain/year-month.js";
import type { FileStore } from "../ports/file-store.js";
import type { PeopleDirectory } from "../ports/people-directory.js";
import type { RecapNotifier } from "../ports/recap-notifier.js";

export type ReminderOutcome = { person: string; status: "reminded" | "confirmed" | "no-recap" | "failed"; error?: string };

/** Caso d'uso: sollecita chi non ha ancora confermato il recap del mese. */
export class SendRecapReminders {
  constructor(
    private readonly people: PeopleDirectory,
    private readonly store: FileStore,
    private readonly notifier: RecapNotifier,
  ) {}

  async execute(month: YearMonth): Promise<ReminderOutcome[]> {
    const outcomes: ReminderOutcome[] = [];
    for (const person of await this.people.all()) {
      try {
        const text = await this.store.readText(DataLayout.recapFile(month, person));
        if (text === null) {
          outcomes.push({ person: person.slug, status: "no-recap" });
          continue;
        }
        const recap = MonthlyRecap.parse(text);
        if (recap.isConfirmed) {
          outcomes.push({ person: person.slug, status: "confirmed" });
          continue;
        }
        await this.notifier.remindRecap(person, recap);
        outcomes.push({ person: person.slug, status: "reminded" });
      } catch (error) {
        outcomes.push({ person: person.slug, status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }
    return outcomes;
  }
}
