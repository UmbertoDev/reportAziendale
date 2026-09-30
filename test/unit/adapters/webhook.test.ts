import { describe, expect, it } from "vitest";
import { BotMessages } from "../../../src/adapters/telegram/bot-messages.js";
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
});
