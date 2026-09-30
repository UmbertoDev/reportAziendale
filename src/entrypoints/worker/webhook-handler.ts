import { BotMessages } from "../../adapters/telegram/bot-messages.js";
import type { TelegramUpdate } from "../../adapters/telegram/telegram-types.js";
import type { Bot } from "./bot-factory.js";

export const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

/**
 * Riceve il webhook Telegram. Risponde sempre 200 agli update validi
 * (altrimenti Telegram ritenta all'infinito) e avvisa l'utente in caso d'errore.
 */
export async function handleWebhook(request: Request, bot: Bot, webhookSecret: string): Promise<Response> {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (request.headers.get(SECRET_HEADER) !== webhookSecret) return new Response("Forbidden", { status: 403 });

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    await bot.dispatcher.dispatch(update);
  } catch (error) {
    console.error("Errore nella gestione dell'update", update.update_id, error);
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
    if (chatId !== undefined) await bot.telegram.sendMessage(chatId, BotMessages.error).catch(() => undefined);
  }
  return new Response("ok");
}
