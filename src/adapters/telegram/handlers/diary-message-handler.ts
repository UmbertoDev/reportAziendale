import type { AppendMessageToDiary } from "../../../application/append-message-to-diary.js";
import { BotMessages } from "../bot-messages.js";
import type { TelegramApi } from "../telegram-api.js";
import type { TelegramUpdate } from "../telegram-types.js";
import { privateText, type UpdateHandler } from "../update-dispatcher.js";

/** Gestore di ripiego: ogni testo che non è un comando va nel diario. */
export class DiaryMessageHandler implements UpdateHandler {
  constructor(
    private readonly appendMessage: AppendMessageToDiary,
    private readonly telegram: TelegramApi,
  ) {}

  canHandle(update: TelegramUpdate): boolean {
    const input = privateText(update);
    return input !== null && !input.text.startsWith("/");
  }

  async handle(update: TelegramUpdate): Promise<void> {
    const { chatId, userId, text } = privateText(update)!;
    const result = await this.appendMessage.execute({ telegramUserId: userId, text });
    const reply = {
      saved: BotMessages.saved,
      "unknown-user": BotMessages.unknownUser(userId),
      "empty-message": BotMessages.emptyMessage,
    }[result.status];
    await this.telegram.sendMessage(chatId, reply);
  }
}
