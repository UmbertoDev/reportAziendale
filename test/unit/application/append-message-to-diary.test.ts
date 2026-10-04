import { describe, expect, it } from "vitest";
import { JsonPeopleDirectory } from "../../../src/adapters/config/json-people-directory.js";
import { AppendMessageToDiary } from "../../../src/application/append-message-to-diary.js";
import { fixedClock, MARIO, storeWithPeople } from "../../support/fakes.js";

function setup() {
  const store = storeWithPeople(MARIO);
  const useCase = new AppendMessageToDiary(
    new JsonPeopleDirectory(store),
    store,
    fixedClock("2026-09-30T08:15:00Z"),
    "Europe/Rome",
  );
  return { store, useCase };
}

describe("AppendMessageToDiary", () => {
  it("salva il messaggio nel diario del giorno con un commit", async () => {
    const { store, useCase } = setup();

    const result = await useCase.execute({ telegramUserId: MARIO.telegramUserId, text: "Chiuso ordine Beta" });

    expect(result).toEqual({ status: "saved", path: "diario/2026-09/2026-09-30-mario.md" });
    expect(store.texts.get("diario/2026-09/2026-09-30-mario.md")).toContain("Chiuso ordine Beta");
    expect(store.commits).toEqual(["diario: mario 2026-09-30 10:15"]);
  });

  it("rifiuta gli utenti non registrati senza scrivere", async () => {
    const { store, useCase } = setup();
    expect(await useCase.execute({ telegramUserId: 999, text: "ciao" })).toEqual({ status: "unknown-user" });
    expect(store.commits).toHaveLength(0);
  });

  it("ignora i messaggi vuoti", async () => {
    const { useCase } = setup();
    expect(await useCase.execute({ telegramUserId: MARIO.telegramUserId, text: "   " })).toEqual({
      status: "empty-message",
    });
  });
});
