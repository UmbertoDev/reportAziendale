import { YearMonth } from "../../domain/year-month.js";

/**
 * Protocollo stateless del bot per la revisione del recap:
 * - pulsanti inline con callback_data "recap:<azione>:<YYYY-MM>"
 * - richiesta d'integrazione con ForceReply: il mese viaggia nel testo del messaggio a cui si risponde.
 */
export type RecapAction = "ok" | "add";

export const RecapProtocol = {
  callbackData(action: RecapAction, month: YearMonth): string {
    return `recap:${action}:${month}`;
  },

  parseCallback(data: string | undefined): { action: RecapAction; month: YearMonth } | null {
    const match = /^recap:(ok|add):(\d{4}-\d{2})$/.exec(data ?? "");
    return match ? { action: match[1] as RecapAction, month: YearMonth.parse(match[2]!) } : null;
  },

  integrationPrompt(month: YearMonth): string {
    return `✍️ Integrazione recap ${month}\nRispondi a questo messaggio con cosa aggiungere o correggere.`;
  },

  parseIntegrationPrompt(text: string | undefined): YearMonth | null {
    const match = /Integrazione recap (\d{4}-\d{2})/.exec(text ?? "");
    return match ? YearMonth.parse(match[1]!) : null;
  },
} as const;
