import type { Person } from "../domain/person.js";

export interface PeopleDirectory {
  findByTelegramId(telegramUserId: number): Promise<Person | null>;
  findBySlug(slug: string): Promise<Person | null>;
  all(): Promise<Person[]>;
}
