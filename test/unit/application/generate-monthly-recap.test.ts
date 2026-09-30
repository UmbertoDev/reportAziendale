import { describe, expect, it } from "vitest";
import { JsonPeopleDirectory } from "../../../src/adapters/config/json-people-directory.js";
import { DiaryReader } from "../../../src/application/diary-reader.js";
import { GenerateMonthlyRecap, type RecapGeneratedListener } from "../../../src/application/generate-monthly-recap.js";
import { MonthlyRecap } from "../../../src/domain/recap.js";
import { YearMonth } from "../../../src/domain/year-month.js";
import {
  FakeContextRepository,
  FakeLlmClient,
  fixedClock,
  LUCIA,
  MARIO,
  storeWithPeople,
} from "../../support/fakes.js";

const month = YearMonth.parse("2026-09");

function setup(llm = new FakeLlmClient(), listeners: RecapGeneratedListener[] = []) {
  const store = storeWithPeople(MARIO, LUCIA);
  store.texts.set("diario/2026-09/2026-09-02-mario.md", "# Diario 02\n\nVisita Alfa");
  store.texts.set("diario/2026-09/2026-09-01-mario.md", "# Diario 01\n\nChiamata Beta");
  store.texts.set("diario/2026-08/2026-08-31-mario.md", "Mese precedente");
  const useCase = new GenerateMonthlyRecap(
    new JsonPeopleDirectory(store),
    new DiaryReader(store),
    store,
    new FakeContextRepository({ "azienda.md": "Azienda ACME", "istruzioni-recap.md": "Istruzioni recap" }),
    llm,
    fixedClock("2026-09-25T07:00:00Z"),
    listeners,
  );
  return { store, llm, useCase };
}

describe("GenerateMonthlyRecap", () => {
  it("genera il recap dai diari del mese, in ordine, con contesto e istruzioni", async () => {
    const { useCase, llm, store } = setup();

    const outcomes = await useCase.execute(month);

    expect(outcomes.map((o) => [o.person, o.status])).toEqual([
      ["mario", "generated"],
      ["lucia", "skipped"],
    ]);
    const request = llm.requests[0]!;
    expect(request.system).toContain("Istruzioni recap");
    expect(request.system).toContain("Azienda ACME");
    expect(request.prompt.indexOf("Chiamata Beta")).toBeLessThan(request.prompt.indexOf("Visita Alfa"));
    expect(request.prompt).not.toContain("Mese precedente");

    const saved = MonthlyRecap.parse(store.texts.get("recap/2026-09/mario.md")!);
    expect(saved.status).toBe("proposto");
    expect(saved.body).toBe("## Sintesi\n\nRecap di prova");
  });

  it("non rigenera un recap esistente se non richiesto", async () => {
    const { useCase, llm } = setup();
    await useCase.execute(month);
    const second = await useCase.execute(month);
    expect(second[0]).toEqual({ person: "mario", status: "skipped", reason: "already-exists" });
    expect(llm.requests).toHaveLength(1);

    await useCase.execute(month, { overwrite: true });
    expect(llm.requests).toHaveLength(2);
  });

  it("un errore su una persona non blocca le altre", async () => {
    const llm = new FakeLlmClient(() => {
      throw new Error("API giù");
    });
    const { useCase } = setup(llm);
    const outcomes = await useCase.execute(month);
    expect(outcomes[0]).toEqual({ person: "mario", status: "failed", error: "API giù" });
    expect(outcomes[1]!.status).toBe("skipped");
  });

  it("avvisa i listener dopo il salvataggio", async () => {
    const notified: string[] = [];
    const { useCase } = setup(undefined, [{ onRecapGenerated: async (p) => void notified.push(p.slug) }]);
    await useCase.execute(month);
    expect(notified).toEqual(["mario"]);
  });
});
