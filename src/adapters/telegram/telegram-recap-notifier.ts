import type { RecapGeneratedListener } from "../../application/generate-monthly-recap.js";
import type { Person } from "../../domain/person.js";
import type { MonthlyRecap } from "../../domain/recap.js";
import type { RecapNotifier } from "../../ports/recap-notifier.js";
import { RecapProtocol } from "./recap-protocol.js";
import type { TelegramApi } from "./telegram-api.js";
import type { ReplyMarkup } from "./telegram-types.js";

/** Limite Telegram 4096 caratteri: teniamo margine per l'intestazione. */
const MAX_CHUNK = 3800;

/** Invia il recap al venditore con i pulsanti Conferma / Integra. */
export class TelegramRecapNotifier implements RecapNotifier, RecapGeneratedListener {
  constructor(private readonly telegram: TelegramApi) {}

  onRecapGenerated(person: Person, recap: MonthlyRecap): Promise<void> {
    return this.proposeRecap(person, recap);
  }

  async proposeRecap(person: Person, recap: MonthlyRecap): Promise<void> {
    const intro = `📋 Recap ${recap.month} - ${person.name}\nTi torna come recap? Conferma oppure integra.\n\n`;
    await this.sendWithButtons(person.telegramUserId, intro + recap.body, this.buttons(recap));
  }

  async remindRecap(person: Person, recap: MonthlyRecap): Promise<void> {
    const text =
      `⏰ Promemoria: il recap ${recap.month} non è ancora confermato.\n` +
      `Se non lo confermi entro fine mese, il report uscirà marcato come "non confermato".`;
    await this.sendWithButtons(person.telegramUserId, text, this.buttons(recap));
  }

  protected buttons(recap: MonthlyRecap): ReplyMarkup {
    return {
      inline_keyboard: [
        [
          { text: "✅ Conferma", callback_data: RecapProtocol.callbackData("ok", recap.month) },
          { text: "✍️ Integra", callback_data: RecapProtocol.callbackData("add", recap.month) },
        ],
      ],
    };
  }

  protected async sendWithButtons(chatId: number, text: string, markup: ReplyMarkup): Promise<void> {
    const chunks = splitText(text, MAX_CHUNK);
    for (const [index, chunk] of chunks.entries()) {
      await this.telegram.sendMessage(chatId, chunk, index === chunks.length - 1 ? markup : undefined);
    }
  }
}

/** Divide il testo su righe intere senza superare `max` caratteri per pezzo. */
export function splitText(text: string, max: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    for (let piece = line; ; piece = piece.slice(max)) {
      const head = piece.slice(0, max);
      if (current && current.length + 1 + head.length > max) {
        chunks.push(current);
        current = head;
      } else {
        current = current ? `${current}\n${head}` : head;
      }
      if (piece.length <= max) break;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
