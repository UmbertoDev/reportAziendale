import { BotMessages } from "../bot-messages.js";
import type { TelegramApi } from "../telegram-api.js";
import type { TelegramUpdate } from "../telegram-types.js";
import { privateText, type UpdateHandler } from "../update-dispatcher.js";

export class StartCommandHandler implements UpdateHandler {
  constructor(private readonly telegram: TelegramApi) {}

  canHandle(update: TelegramUpdate): boolean {
    return privateText(update)?.text.trim().startsWith("/start") ?? false;
  }

  async handle(update: TelegramUpdate): Promise<void> {
    const input = privateText(update)!;
    await this.telegram.sendMessage(input.chatId, BotMessages.welcome(input.userId));
  }
}
