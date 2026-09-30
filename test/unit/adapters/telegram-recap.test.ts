import { describe, expect, it } from "vitest";
import { RecapProtocol } from "../../../src/adapters/telegram/recap-protocol.js";
import { splitText, TelegramRecapNotifier } from "../../../src/adapters/telegram/telegram-recap-notifier.js";
import { MonthlyRecap } from "../../../src/domain/recap.js";
import { YearMonth } from "../../../src/domain/year-month.js";
import { FakeTelegramApi, MARIO } from "../../support/fakes.js";

const month = YearMonth.parse("2026-09");

describe("RecapProtocol", () => {
  it("codifica e decodifica i pulsanti", () => {
    const data = RecapProtocol.callbackData("ok", month);
    expect(data).toBe("recap:ok:2026-09");
    expect(RecapProtocol.parseCallback(data)).toEqual({ action: "ok", month });
    expect(RecapProtocol.parseCallback("altro")).toBeNull();
  });

  it("ritrova il mese dalla richiesta d'integrazione", () => {
    expect(RecapProtocol.parseIntegrationPrompt(RecapProtocol.integrationPrompt(month))).toEqual(month);
    expect(RecapProtocol.parseIntegrationPrompt("Salvato nel diario")).toBeNull();
  });
});

describe("splitText", () => {
  it("non spezza testi corti", () => {
    expect(splitText("a\nb", 10)).toEqual(["a\nb"]);
  });

  it("divide su righe intere e taglia le righe troppo lunghe", () => {
    expect(splitText("aaaa\nbbbb\ncc", 9)).toEqual(["aaaa\nbbbb", "cc"]);
    expect(splitText("x".repeat(12), 5)).toEqual(["xxxxx", "xxxxx", "xx"]);
  });
});

describe("TelegramRecapNotifier", () => {
  it("invia il recap alla persona con i pulsanti sull'ultimo messaggio", async () => {
    const telegram = new FakeTelegramApi();
    const recap = MonthlyRecap.propose("mario", month, "r".repeat(5000), new Date());

    await new TelegramRecapNotifier(telegram).proposeRecap(MARIO, recap);

    expect(telegram.sent.length).toBeGreaterThan(1);
    expect(telegram.sent.every((m) => m.chatId === MARIO.telegramUserId)).toBe(true);
    expect(telegram.sent[0]!.text).toContain("Ti torna come recap?");
    expect(telegram.sent[0]!.replyMarkup).toBeUndefined();
    expect(telegram.sent.at(-1)!.replyMarkup).toEqual({
      inline_keyboard: [
        [
          { text: "✅ Conferma", callback_data: "recap:ok:2026-09" },
          { text: "✍️ Integra", callback_data: "recap:add:2026-09" },
        ],
      ],
    });
  });
});
