import { describe, expect, it } from "vitest";
import { BotMessages } from "../../../src/adapters/telegram/bot-messages.js";
import { MonthlyRecap } from "../../../src/domain/recap.js";
import { YearMonth } from "../../../src/domain/year-month.js";
import { createBot } from "../../../src/entrypoints/worker/bot-factory.js";
import { handleWebhook, SECRET_HEADER } from "../../../src/entrypoints/worker/webhook-handler.js";
import { FakeTelegramApi, fixedClock, MARIO, storeWithPeople, textUpdate } from "../../support/fakes.js";

const SECRET = "s3cret";

function setup() {
  const store = storeWithPeople(MARIO);
  const telegram = new FakeTelegramApi();
  const bot = createBot({ store, telegram, clock: fixedClock("2026-09-30T08:15:00Z"), timeZone: "Europe/Rome" });
  const post = (body: unknown, secret = SECRET) =>
    handleWebhook(
      new Request("https://bot/telegram/webhook", {
        method: "POST",
        headers: { [SECRET_HEADER]: secret },
        body: JSON.stringify(body),
      }),
      bot,
      SECRET,
    );
  return { store, telegram, post };
}

describe("webhook Telegram", () => {
  it("rifiuta richieste senza secret corretto", async () => {
    const { post, store } = setup();
    expect((await post(textUpdate(MARIO.telegramUserId, "x"), "sbagliato")).status).toBe(403);
    expect(store.commits).toHaveLength(0);
  });

  it("salva il testo nel diario e conferma all'utente", async () => {
    const { post, store, telegram } = setup();
    const response = await post(textUpdate(MARIO.telegramUserId, "Visita Alfa"));

    expect(response.status).toBe(200);
    expect(store.texts.get("diario/2026-09/2026-09-30-mario.md")).toContain("Visita Alfa");
    expect(telegram.sent).toEqual([{ chatId: MARIO.telegramUserId, text: BotMessages.saved }]);
  });

  it("/start risponde con l'id da registrare senza salvare", async () => {
    const { post, store, telegram } = setup();
    await post(textUpdate(555, "/start"));
    expect(telegram.sent[0]!.text).toContain("555");
    expect(store.commits).toHaveLength(0);
  });

  it("ignora i messaggi di gruppo", async () => {
    const { post, telegram } = setup();
    const update = textUpdate(MARIO.telegramUserId, "x");
    update.message.chat = { id: -1, type: "group" as never };
    expect((await post(update)).status).toBe(200);
    expect(telegram.sent).toHaveLength(0);
  });

  it("in caso d'errore risponde 200 e avvisa l'utente", async () => {
    const { post, store, telegram } = setup();
    store.updateText = async () => {
      throw new Error("GitHub giù");
    };
    const response = await post(textUpdate(MARIO.telegramUserId, "x"));
    expect(response.status).toBe(200);
    expect(telegram.sent.at(-1)!.text).toBe(BotMessages.error);
  });

  describe("revisione recap", () => {
    const RECAP = "recap/2026-09/mario.md";
    const callback = (data: string) => ({
      update_id: 9,
      callback_query: {
        id: "cb1",
        from: { id: MARIO.telegramUserId },
        data,
        message: { message_id: 5, chat: { id: MARIO.telegramUserId, type: "private" as const } },
      },
    });
    const withRecap = () => {
      const ctx = setup();
      ctx.store.texts.set(RECAP, MonthlyRecap.propose("mario", YearMonth.parse("2026-09"), "Testo", new Date()).serialize());
      return ctx;
    };

    it("il pulsante Conferma conferma il recap", async () => {
      const { post, store, telegram } = withRecap();
      await post(callback("recap:ok:2026-09"));
      expect(MonthlyRecap.parse(store.texts.get(RECAP)!).isConfirmed).toBe(true);
      expect(telegram.answeredCallbacks).toEqual([{ id: "cb1", text: "Confermato" }]);
      expect(telegram.sent.at(-1)!.text).toBe(BotMessages.review.confirmed);
    });

    it("il pulsante Integra chiede il testo e la risposta finisce nel recap, non nel diario", async () => {
      const { post, store, telegram } = withRecap();
      await post(callback("recap:add:2026-09"));
      const prompt = telegram.sent.at(-1)!;
      expect(prompt.replyMarkup).toMatchObject({ force_reply: true });

      const reply = textUpdate(MARIO.telegramUserId, "Aggiungo ordine Gamma", 10);
      Object.assign(reply.message, {
        reply_to_message: { message_id: 6, chat: reply.message.chat, text: prompt.text },
      });
      await post(reply);

      const recap = MonthlyRecap.parse(store.texts.get(RECAP)!);
      expect(recap.integrations.map((i) => i.text)).toEqual(["Aggiungo ordine Gamma"]);
      expect([...store.texts.keys()].some((k) => k.startsWith("diario/"))).toBe(false);
      expect(telegram.sent.at(-1)!.text).toBe(BotMessages.review.integrated);
    });
  });
});
