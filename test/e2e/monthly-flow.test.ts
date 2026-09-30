import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { JsonPeopleDirectory } from "../../src/adapters/config/json-people-directory.js";
import { FsTemplateSource } from "../../src/adapters/pptx/fs-template-source.js";
import { PptxTemplateRenderer } from "../../src/adapters/pptx/pptx-template-renderer.js";
import { TelegramRecapNotifier } from "../../src/adapters/telegram/telegram-recap-notifier.js";
import { BuildMonthlyReport } from "../../src/application/build-monthly-report.js";
import { DiaryReader } from "../../src/application/diary-reader.js";
import { GenerateMonthlyRecap } from "../../src/application/generate-monthly-recap.js";
import { YearMonth } from "../../src/domain/year-month.js";
import { createBot } from "../../src/entrypoints/worker/bot-factory.js";
import { handleWebhook, SECRET_HEADER } from "../../src/entrypoints/worker/webhook-handler.js";
import { FakeLlmClient, FakeTelegramApi, fixedClock, MARIO, storeWithPeople, textUpdate } from "../support/fakes.js";

/**
 * Unico test end-to-end: messaggio Telegram → diario → recap → conferma → PPT.
 * Tutto reale tranne i sistemi esterni (GitHub, Telegram, LLM).
 */
describe("flusso mensile completo", () => {
  it("dal messaggio del venditore al report PPT", async () => {
    const store = storeWithPeople(MARIO);
    const telegram = new FakeTelegramApi();
    const clock = fixedClock("2026-09-10T08:00:00Z");
    const bot = createBot({ store, telegram, clock, timeZone: "Europe/Rome" });
    const post = (update: unknown) =>
      handleWebhook(
        new Request("https://bot/telegram/webhook", {
          method: "POST",
          headers: { [SECRET_HEADER]: "s" },
          body: JSON.stringify(update),
        }),
        bot,
        "s",
      );
    const people = new JsonPeopleDirectory(store);
    const month = YearMonth.parse("2026-09");

    // 1. Il venditore scrive al bot
    await post(textUpdate(MARIO.telegramUserId, "Chiuso ordine Alfa da 20k"));
    expect(store.texts.get("diario/2026-09/2026-09-10-mario.md")).toContain("Chiuso ordine Alfa");

    // 2. Il 25 il job genera il recap e lo invia su Telegram
    clock.set("2026-09-25T07:00:00Z");
    const recapLlm = new FakeLlmClient((r) => `## Sintesi\n\n${r.prompt.includes("Alfa") ? "Ordine Alfa chiuso" : "?"}`);
    await new GenerateMonthlyRecap(people, new DiaryReader(store), store, { read: async () => "" }, recapLlm, clock, [
      new TelegramRecapNotifier(telegram),
    ]).execute(month);
    const proposal = telegram.sent.at(-1)!;
    expect(proposal.text).toContain("Ordine Alfa chiuso");

    // 3. Il venditore conferma dal pulsante
    const confirmButton = (proposal.replyMarkup as { inline_keyboard: { callback_data: string }[][] }).inline_keyboard[0]![0]!;
    await post({
      update_id: 2,
      callback_query: { id: "cb", from: { id: MARIO.telegramUserId }, data: confirmButton.callback_data },
    });
    expect(store.texts.get("recap/2026-09/mario.md")).toContain("stato: confermato");

    // 4. L'ultimo giorno il job crea il PPT dal template
    const renderer = new PptxTemplateRenderer();
    const reportLlm = new FakeLlmClient((r) => {
      const schema = r.jsonSchema as { required: string[] };
      return JSON.stringify(Object.fromEntries(schema.required.map((k) => [k, `testo ${k}`])));
    });
    const outcomes = await new BuildMonthlyReport(
      people,
      new DiaryReader(store),
      store,
      { read: async () => "" },
      reportLlm,
      new FsTemplateSource(),
      renderer,
    ).execute(month);

    expect(outcomes[0]).toMatchObject({ status: "generated", recapConfirmed: true });
    const pptx = store.binaries.get("report/2026-09/2026-09-mario.pptx")!;
    expect(await renderer.placeholders(pptx)).toEqual([]);
    const slides = await JSZip.loadAsync(pptx);
    expect(Object.keys(slides.files)).toEqual(Object.keys((await JSZip.loadAsync(await readFile("templates/report-mensile.pptx"))).files));
    expect(await slides.file("ppt/slides/slide1.xml")!.async("string")).toContain("confermato dal venditore");
  });
});
