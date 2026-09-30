import { DataLayout } from "../domain/data-layout.js";
import { DiaryFormatter, type DiaryEntry } from "../domain/diary.js";
import { LocalDateTime } from "../domain/local-date-time.js";
import type { Clock } from "../ports/clock.js";
import type { FileStore } from "../ports/file-store.js";
import type { PeopleDirectory } from "../ports/people-directory.js";

export interface AppendMessageCommand {
  telegramUserId: number;
  text: string;
}

export type AppendMessageResult =
  | { status: "saved"; path: string }
  | { status: "unknown-user" }
  | { status: "empty-message" };

/** Caso d'uso: salva il messaggio del venditore nel diario del giorno. */
export class AppendMessageToDiary {
  constructor(
    private readonly people: PeopleDirectory,
    private readonly store: FileStore,
    private readonly clock: Clock,
    private readonly timeZone: string,
  ) {}

  async execute(command: AppendMessageCommand): Promise<AppendMessageResult> {
    const text = command.text.trim();
    if (!text) return { status: "empty-message" };

    const person = await this.people.findByTelegramId(command.telegramUserId);
    if (!person) return { status: "unknown-user" };

    const entry: DiaryEntry = { person, text, at: LocalDateTime.from(this.clock.now(), this.timeZone) };
    const path = DataLayout.diaryFile(person, entry.at);

    await this.store.updateText(
      path,
      (current) => DiaryFormatter.append(current, entry),
      `diario: ${person.slug} ${entry.at.isoDate} ${entry.at.time}`,
    );
    return { status: "saved", path };
  }
}
