import { z } from "zod";
import { DataLayout } from "../../domain/data-layout.js";
import { assertValidSlug, type Person } from "../../domain/person.js";
import type { FileStore } from "../../ports/file-store.js";
import type { PeopleDirectory } from "../../ports/people-directory.js";

const PeopleSchema = z.array(
  z.object({
    slug: z.string(),
    nome: z.string().min(1),
    telegramUserId: z.number().int().positive(),
  }),
);

/** Anagrafica venditori letta da config/persone.json nel repo dati (letta una volta, poi in cache). */
export class JsonPeopleDirectory implements PeopleDirectory {
  private cache: Promise<Person[]> | null = null;

  constructor(
    private readonly store: FileStore,
    private readonly path: string = DataLayout.peopleFile,
  ) {}

  async findByTelegramId(telegramUserId: number): Promise<Person | null> {
    return (await this.all()).find((p) => p.telegramUserId === telegramUserId) ?? null;
  }

  async findBySlug(slug: string): Promise<Person | null> {
    return (await this.all()).find((p) => p.slug === slug) ?? null;
  }

  all(): Promise<Person[]> {
    this.cache ??= this.load();
    return this.cache;
  }

  private async load(): Promise<Person[]> {
    const raw = await this.store.readText(this.path);
    if (raw === null) return [];
    const people = PeopleSchema.parse(JSON.parse(raw)).map((p) => {
      assertValidSlug(p.slug);
      return { slug: p.slug, name: p.nome, telegramUserId: p.telegramUserId };
    });
    return people;
  }
}
