import type { ReviewRecap, ReviewResult } from "../../../application/review-recap.js";
import { BotMessages } from "../bot-messages.js";
import { RecapProtocol } from "../recap-protocol.js";
import type { TelegramApi } from "../telegram-api.js";
import type { TelegramUpdate } from "../telegram-types.js";
import type { UpdateHandler } from "../update-dispatcher.js";

/** Pulsanti "Conferma" e "Integra" sotto il recap. */
export class RecapCallbackHandler implements UpdateHandler {
  constructor(
    private readonly review: ReviewRecap,
    private readonly telegram: TelegramApi,
  ) {}

  canHandle(update: TelegramUpdate): boolean {
    return RecapProtocol.parseCallback(update.callback_query?.data) !== null;
  }

  async handle(update: TelegramUpdate): Promise<void> {
    const query = update.callback_query!;
    const { action, month } = RecapProtocol.parseCallback(query.data)!;
    const chatId = query.message?.chat.id ?? query.from.id;

    if (action === "add") {
      await this.telegram.answerCallbackQuery(query.id);
      await this.telegram.sendMessage(chatId, RecapProtocol.integrationPrompt(month), {
        force_reply: true,
        input_field_placeholder: "Cosa vuoi aggiungere?",
      });
      return;
    }

    const result = await this.review.confirm(query.from.id, month);
    await this.telegram.answerCallbackQuery(query.id, result === "confirmed" ? "Confermato" : undefined);
    await this.telegram.sendMessage(chatId, replyFor(result));
  }
}

export function replyFor(result: ReviewResult): string {
  return BotMessages.review[result];
}
