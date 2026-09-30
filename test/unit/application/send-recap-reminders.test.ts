import { describe, expect, it } from "vitest";
import { JsonPeopleDirectory } from "../../../src/adapters/config/json-people-directory.js";
import { TelegramRecapNotifier } from "../../../src/adapters/telegram/telegram-recap-notifier.js";
import { SendRecapReminders } from "../../../src/application/send-recap-reminders.js";
import { MonthlyRecap } from "../../../src/domain/recap.js";
import { YearMonth } from "../../../src/domain/year-month.js";
import { FakeTelegramApi, LUCIA, MARIO, storeWithPeople } from "../../support/fakes.js";

const month = YearMonth.parse("2026-09");
const OTHER: typeof MARIO = { slug: "gino", name: "Gino", telegramUserId: 333 };

describe("SendRecapReminders", () => {
  it("sollecita solo chi ha un recap ancora proposto", async () => {
    const store = storeWithPeople(MARIO, LUCIA, OTHER);
    store.texts.set("recap/2026-09/mario.md", MonthlyRecap.propose("mario", month, "R", new Date()).serialize());
    store.texts.set(
      "recap/2026-09/lucia.md",
      MonthlyRecap.propose("lucia", month, "R", new Date()).confirm(new Date()).serialize(),
    );
    const telegram = new FakeTelegramApi();

    const outcomes = await new SendRecapReminders(
      new JsonPeopleDirectory(store),
      store,
      new TelegramRecapNotifier(telegram),
    ).execute(month);

    expect(outcomes.map((o) => [o.person, o.status])).toEqual([
      ["mario", "reminded"],
      ["lucia", "confirmed"],
      ["gino", "no-recap"],
    ]);
    expect(telegram.sent).toHaveLength(1);
    expect(telegram.sent[0]).toMatchObject({ chatId: MARIO.telegramUserId });
    expect(telegram.sent[0]!.text).toContain("non confermato");
    expect(telegram.sent[0]!.replyMarkup).toBeDefined();
  });
});
