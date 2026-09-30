import type { TelegramUpdate } from "./telegram-types.js";

/** Un gestore per un tipo di update (Chain of Responsibility). */
export interface UpdateHandler {
  canHandle(update: TelegramUpdate): boolean;
  handle(update: TelegramUpdate): Promise<void>;
}

/** Passa l'update al primo gestore competente; l'ordine conta. */
export class UpdateDispatcher {
  constructor(private readonly handlers: readonly UpdateHandler[]) {}

  async dispatch(update: TelegramUpdate): Promise<boolean> {
    const handler = this.handlers.find((h) => h.canHandle(update));
    if (!handler) return false;
    await handler.handle(update);
    return true;
  }
}

/** Messaggio testuale in chat privata, il solo input accettato dal bot. */
export function privateText(update: TelegramUpdate): { chatId: number; userId: number; text: string } | null {
  const message = update.message;
  if (!message?.text || !message.from || message.chat.type !== "private") return null;
  return { chatId: message.chat.id, userId: message.from.id, text: message.text };
}
