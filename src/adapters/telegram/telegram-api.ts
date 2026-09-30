import type { ReplyMarkup } from "./telegram-types.js";

/** Porta verso la Bot API: i gestori dipendono da questa interfaccia, non da fetch. */
export interface TelegramApi {
  sendMessage(chatId: number, text: string, replyMarkup?: ReplyMarkup): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
}

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    detail: string,
  ) {
    super(`Telegram ${method} fallita (${status}): ${detail}`);
    this.name = "TelegramApiError";
  }
}

export class HttpTelegramApi implements TelegramApi {
  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly baseUrl = "https://api.telegram.org",
  ) {}

  sendMessage(chatId: number, text: string, replyMarkup?: ReplyMarkup): Promise<void> {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    return this.call("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
  }

  private async call(method: string, payload: Record<string, unknown>): Promise<void> {
    const response = await this.fetchFn(`${this.baseUrl}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new TelegramApiError(method, response.status, (await response.text()).slice(0, 300));
    }
  }
}
