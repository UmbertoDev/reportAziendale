import type { ContextRepository } from "../../src/ports/context-repository.js";
import type { LlmClient, LlmRequest } from "../../src/ports/llm-client.js";
import type { TelegramApi } from "../../src/adapters/telegram/telegram-api.js";
import type { ReplyMarkup } from "../../src/adapters/telegram/telegram-types.js";
import type { Person } from "../../src/domain/person.js";
import type { Clock } from "../../src/ports/clock.js";
import type { FileStore } from "../../src/ports/file-store.js";

export class InMemoryFileStore implements FileStore {
  readonly texts = new Map<string, string>();
  readonly binaries = new Map<string, Uint8Array>();
  readonly commits: string[] = [];

  async readText(path: string): Promise<string | null> {
    return this.texts.get(path) ?? null;
  }

  async updateText(path: string, transform: (current: string | null) => string, message: string): Promise<void> {
    this.texts.set(path, transform(this.texts.get(path) ?? null));
    this.commits.push(message);
  }

  async writeBinary(path: string, content: Uint8Array, message: string): Promise<void> {
    this.binaries.set(path, content);
    this.commits.push(message);
  }

  async list(dir: string): Promise<string[]> {
    const prefix = `${dir}/`;
    return [...this.texts.keys(), ...this.binaries.keys()]
      .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
      .sort();
  }
}

export interface SentMessage {
  chatId: number;
  text: string;
  replyMarkup?: ReplyMarkup;
}

export class FakeTelegramApi implements TelegramApi {
  readonly sent: SentMessage[] = [];
  readonly answeredCallbacks: { id: string; text?: string }[] = [];

  async sendMessage(chatId: number, text: string, replyMarkup?: ReplyMarkup): Promise<void> {
    this.sent.push({ chatId, text, ...(replyMarkup ? { replyMarkup } : {}) });
  }

  async answerCallbackQuery(id: string, text?: string): Promise<void> {
    this.answeredCallbacks.push({ id, ...(text ? { text } : {}) });
  }
}

export const fixedClock = (iso: string): Clock & { set(iso: string): void } => {
  let now = new Date(iso);
  return { now: () => now, set: (value: string) => (now = new Date(value)) };
};

export const MARIO: Person = { slug: "mario", name: "Mario Rossi", telegramUserId: 111 };
export const LUCIA: Person = { slug: "lucia", name: "Lucia Bianchi", telegramUserId: 222 };

export function peopleJson(...people: Person[]): string {
  return JSON.stringify(people.map((p) => ({ slug: p.slug, nome: p.name, telegramUserId: p.telegramUserId })));
}

export function storeWithPeople(...people: Person[]): InMemoryFileStore {
  const store = new InMemoryFileStore();
  store.texts.set("config/persone.json", peopleJson(...people));
  return store;
}

export const textUpdate = (userId: number, text: string, updateId = 1) => ({
  update_id: updateId,
  message: {
    message_id: updateId,
    from: { id: userId },
    chat: { id: userId, type: "private" as const },
    text,
  },
});

export class FakeLlmClient implements LlmClient {
  readonly requests: LlmRequest[] = [];

  constructor(private readonly reply: (request: LlmRequest) => string = () => "## Sintesi\n\nRecap di prova") {}

  async complete(request: LlmRequest): Promise<string> {
    this.requests.push(request);
    return this.reply(request);
  }
}

export class FakeContextRepository implements ContextRepository {
  constructor(private readonly docs: Record<string, string> = {}) {}

  async read(name: string): Promise<string> {
    return this.docs[name] ?? "";
  }
}
