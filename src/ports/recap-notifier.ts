import type { Person } from "../domain/person.js";
import type { MonthlyRecap } from "../domain/recap.js";

/** Canale con cui il recap arriva al venditore per conferma o integrazione. */
export interface RecapNotifier {
  proposeRecap(person: Person, recap: MonthlyRecap): Promise<void>;
  /** Sollecito per un recap ancora da confermare. */
  remindRecap(person: Person, recap: MonthlyRecap): Promise<void>;
}
