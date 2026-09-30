import { DataLayout } from "../domain/data-layout.js";
import { MonthlyRecap } from "../domain/recap.js";
import type { YearMonth } from "../domain/year-month.js";
import type { Clock } from "../ports/clock.js";
import type { FileStore } from "../ports/file-store.js";
import type { PeopleDirectory } from "../ports/people-directory.js";

export type ReviewResult = "confirmed" | "already-confirmed" | "integrated" | "recap-not-found" | "unknown-user";

class RecapNotFound extends Error {}

/** Caso d'uso: il venditore conferma il recap proposto oppure lo integra. */
export class ReviewRecap {
  constructor(
    private readonly people: PeopleDirectory,
    private readonly store: FileStore,
    private readonly clock: Clock,
  ) {}

  confirm(telegramUserId: number, month: YearMonth): Promise<ReviewResult> {
    return this.transition(telegramUserId, month, "conferma", (recap) =>
      recap.isConfirmed ? { recap, result: "already-confirmed" } : { recap: recap.confirm(this.clock.now()), result: "confirmed" },
    );
  }

  integrate(telegramUserId: number, month: YearMonth, text: string): Promise<ReviewResult> {
    return this.transition(telegramUserId, month, "integrazione", (recap) => ({
      recap: recap.integrate(text, this.clock.now()),
      result: "integrated",
    }));
  }

  private async transition(
    telegramUserId: number,
    month: YearMonth,
    action: string,
    apply: (recap: MonthlyRecap) => { recap: MonthlyRecap; result: ReviewResult },
  ): Promise<ReviewResult> {
    const person = await this.people.findByTelegramId(telegramUserId);
    if (!person) return "unknown-user";

    let result: ReviewResult = "recap-not-found";
    try {
      await this.store.updateText(
        DataLayout.recapFile(month, person),
        (current) => {
          if (current === null) throw new RecapNotFound();
          const next = apply(MonthlyRecap.parse(current));
          result = next.result;
          return next.recap.serialize();
        },
        `recap: ${action} ${person.slug} ${month}`,
      );
    } catch (error) {
      if (error instanceof RecapNotFound) return "recap-not-found";
      throw error;
    }
    return result;
  }
}
