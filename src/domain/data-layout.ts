import type { LocalDateTime } from "./local-date-time.js";
import type { Person } from "./person.js";
import type { YearMonth } from "./year-month.js";

/**
 * Unica fonte di verità sui percorsi dei dati nel repo.
 *
 * diario/2026-09/2026-09-30-mario.md
 * recap/2026-09/mario.md
 * report/2026-09/2026-09-mario.pptx
 */
export const DataLayout = {
  peopleFile: "config/persone.json",

  diaryDir(month: YearMonth): string {
    return `diario/${month}`;
  },

  diaryFile(person: Person, date: LocalDateTime): string {
    return `${this.diaryDir(date.yearMonth)}/${date.isoDate}-${person.slug}.md`;
  },

  isDiaryFileOf(path: string, person: Person): boolean {
    return path.endsWith(`-${person.slug}.md`);
  },

  recapFile(month: YearMonth, person: Person): string {
    return `recap/${month}/${person.slug}.md`;
  },

  reportFile(month: YearMonth, person: Person): string {
    return `report/${month}/${month}-${person.slug}.pptx`;
  },
} as const;
