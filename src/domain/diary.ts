import type { LocalDateTime } from "./local-date-time.js";
import type { Person } from "./person.js";

/** Un messaggio del venditore, già collocato nel suo giorno locale. */
export interface DiaryEntry {
  readonly person: Person;
  readonly at: LocalDateTime;
  readonly text: string;
}

/** Regole di formattazione del file Markdown giornaliero. */
export const DiaryFormatter = {
  header(entry: DiaryEntry): string {
    return `# Diario ${entry.at.isoDate} - ${entry.person.name}\n`;
  },

  section(entry: DiaryEntry): string {
    return `\n## ${entry.at.time}\n\n${entry.text.trim()}\n`;
  },

  /** Aggiunge la voce al contenuto esistente (o crea il file). */
  append(current: string | null, entry: DiaryEntry): string {
    const base = current ?? this.header(entry);
    return `${base.replace(/\s*$/, "\n")}${this.section(entry)}`;
  },
} as const;
