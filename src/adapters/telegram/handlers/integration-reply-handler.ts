import type { ReviewRecap } from "../../../application/review-recap.js";
import { RecapProtocol } from "../recap-protocol.js";
import type { TelegramApi } from "../telegram-api.js";
import type { TelegramUpdate } from "../telegram-types.js";
import { privateText, type UpdateHandler } from "../update-dispatcher.js";
import { replyFor } from "./recap-callback-handler.js";

/** Risposta del venditore alla richiesta d'integrazione: va nel recap, non nel diario. */
export class IntegrationReplyHandler implements UpdateHandler {
  constructor(
    private readonly review: ReviewRecap,
    private readonly telegram: TelegramApi,
  ) {}

  canHandle(update: TelegramUpdate): boolean {
    return privateText(update) !== null && this.monthOf(update) !== null;
  }

  async handle(update: TelegramUpdate): Promise<void> {
    const { chatId, userId, text } = privateText(update)!;
    const result = await this.review.integrate(userId, this.monthOf(update)!, text);
    await this.telegram.sendMessage(chatId, replyFor(result));
  }

  private monthOf(update: TelegramUpdate) {
    return RecapProtocol.parseIntegrationPrompt(update.message?.reply_to_message?.text);
  }
}
