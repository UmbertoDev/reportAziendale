import { describe, expect, it } from "vitest";
import { JsonPeopleDirectory } from "../../../src/adapters/config/json-people-directory.js";
import { ReviewRecap } from "../../../src/application/review-recap.js";
import { MonthlyRecap } from "../../../src/domain/recap.js";
import { YearMonth } from "../../../src/domain/year-month.js";
import { fixedClock, MARIO, storeWithPeople } from "../../support/fakes.js";

const month = YearMonth.parse("2026-09");
const PATH = "recap/2026-09/mario.md";

function setup(withRecap = true) {
  const store = storeWithPeople(MARIO);
  if (withRecap) {
    store.texts.set(PATH, MonthlyRecap.propose("mario", month, "Testo", new Date("2026-09-25T07:00:00Z")).serialize());
  }
  const review = new ReviewRecap(new JsonPeopleDirectory(store), store, fixedClock("2026-09-26T09:00:00Z"));
  const saved = () => MonthlyRecap.parse(store.texts.get(PATH)!);
  return { store, review, saved };
}

describe("ReviewRecap", () => {
  it("conferma il recap proposto", async () => {
    const { review, saved, store } = setup();
    expect(await review.confirm(MARIO.telegramUserId, month)).toBe("confirmed");
    expect(saved().isConfirmed).toBe(true);
    expect(store.commits).toEqual(["recap: conferma mario 2026-09"]);
  });

  it("una seconda conferma non crea commit", async () => {
    const { review, store } = setup();
    await review.confirm(MARIO.telegramUserId, month);
    expect(await review.confirm(MARIO.telegramUserId, month)).toBe("already-confirmed");
    expect(store.commits).toHaveLength(1);
  });

  it("salva l'integrazione e conferma", async () => {
    const { review, saved } = setup();
    expect(await review.integrate(MARIO.telegramUserId, month, "Manca l'ordine Gamma")).toBe("integrated");
    expect(saved().integrations.map((i) => i.text)).toEqual(["Manca l'ordine Gamma"]);
    expect(saved().isConfirmed).toBe(true);
  });

  it("gestisce recap mancante e utente sconosciuto", async () => {
    const { review, store } = setup(false);
    expect(await review.confirm(MARIO.telegramUserId, month)).toBe("recap-not-found");
    expect(await review.confirm(999, month)).toBe("unknown-user");
    expect(store.commits).toHaveLength(0);
  });
});
