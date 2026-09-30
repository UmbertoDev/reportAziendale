import { DataLayout } from "../domain/data-layout.js";
import type { Person } from "../domain/person.js";
import type { YearMonth } from "../domain/year-month.js";
import type { FileStore } from "../ports/file-store.js";

/** Raccoglie i diari giornalieri di una persona in un mese, in ordine di data. */
export class DiaryReader {
  constructor(private readonly store: FileStore) {}

  async monthOf(person: Person, month: YearMonth): Promise<string> {
    const paths = (await this.store.list(DataLayout.diaryDir(month))).filter((p) => DataLayout.isDiaryFileOf(p, person));
    const contents = await Promise.all(paths.map((p) => this.store.readText(p)));
    return contents
      .filter((c): c is string => c !== null)
      .map((c) => c.trim())
      .join("\n\n");
  }
}
