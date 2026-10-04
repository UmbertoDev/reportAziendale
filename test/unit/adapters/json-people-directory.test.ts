import { describe, expect, it } from "vitest";
import { JsonPeopleDirectory } from "../../../src/adapters/config/json-people-directory.js";
import { InMemoryFileStore, LUCIA, MARIO, storeWithPeople } from "../../support/fakes.js";

describe("JsonPeopleDirectory", () => {
  it("trova le persone per id Telegram e per slug", async () => {
    const directory = new JsonPeopleDirectory(storeWithPeople(MARIO, LUCIA));
    expect(await directory.findByTelegramId(222)).toEqual(LUCIA);
    expect(await directory.findBySlug("mario")).toEqual(MARIO);
    expect(await directory.findByTelegramId(999)).toBeNull();
  });

  it("restituisce elenco vuoto se il file non esiste", async () => {
    expect(await new JsonPeopleDirectory(new InMemoryFileStore()).all()).toEqual([]);
  });

  it("rifiuta slug non validi", async () => {
    const store = new InMemoryFileStore();
    store.texts.set("config/persone.json", JSON.stringify([{ slug: "Mario Rossi", nome: "M", telegramUserId: 1 }]));
    await expect(new JsonPeopleDirectory(store).all()).rejects.toThrow(/Slug/);
  });
});
