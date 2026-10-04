import { describe, expect, it } from "vitest";
import { JsonPeopleDirectory } from "../../../src/adapters/config/json-people-directory.js";
import {
  BuildMonthlyReport,
  contentJsonSchema,
  monthLabel,
  RecapStatusLabel,
} from "../../../src/application/build-monthly-report.js";
import { DiaryReader } from "../../../src/application/diary-reader.js";
import { MonthlyRecap } from "../../../src/domain/recap.js";
import { YearMonth } from "../../../src/domain/year-month.js";
import type { PresentationRenderer } from "../../../src/ports/presentation.js";
import { FakeContextRepository, FakeLlmClient, LUCIA, MARIO, storeWithPeople } from "../../support/fakes.js";

const month = YearMonth.parse("2026-09");

/** Renderer finto: "renderizza" i valori ricevuti come JSON. */
class RecordingRenderer implements PresentationRenderer {
  async placeholders(): Promise<string[]> {
    return ["titolo", "mese", "venditore", "stato_recap", "sintesi"];
  }

  async render(_t: Uint8Array, values: Readonly<Record<string, string>>): Promise<Uint8Array> {
    return new TextEncoder().encode(JSON.stringify(values));
  }
}

function setup(llmReply = JSON.stringify({ titolo: "Titolo", sintesi: "Sintesi" })) {
  const store = storeWithPeople(MARIO, LUCIA);
  const recap = MonthlyRecap.propose("mario", month, "Recap Mario", new Date("2026-09-25T07:00:00Z"));
  store.texts.set("recap/2026-09/mario.md", recap.integrate("Integrazione", new Date()).serialize());
  store.texts.set("recap/2026-09/lucia.md", MonthlyRecap.propose("lucia", month, "Recap Lucia", new Date()).serialize());
  store.texts.set("diario/2026-09/2026-09-29-mario.md", "Diario dopo il recap");
  const llm = new FakeLlmClient(() => llmReply);
  const useCase = new BuildMonthlyReport(
    new JsonPeopleDirectory(store),
    new DiaryReader(store),
    store,
    new FakeContextRepository({ "istruzioni-report.md": "Istruzioni report" }),
    llm,
    { load: async () => new Uint8Array([1]) },
    new RecordingRenderer(),
  );
  const rendered = (path: string) => JSON.parse(new TextDecoder().decode(store.binaries.get(path)!));
  return { store, llm, useCase, rendered };
}

describe("BuildMonthlyReport", () => {
  it("genera un PPT per venditore con valori LLM e valori di sistema", async () => {
    const { useCase, rendered } = setup();

    const outcomes = await useCase.execute(month);

    expect(outcomes).toEqual([
      { person: "mario", status: "generated", path: "report/2026-09/2026-09-mario.pptx", recapConfirmed: true },
      { person: "lucia", status: "generated", path: "report/2026-09/2026-09-lucia.pptx", recapConfirmed: false },
    ]);
    expect(rendered("report/2026-09/2026-09-mario.pptx")).toEqual({
      titolo: "Titolo",
      sintesi: "Sintesi",
      mese: "Settembre 2026",
      venditore: "Mario Rossi",
      stato_recap: RecapStatusLabel.confirmed,
    });
  });

  it("se il recap non è stato confermato il report esce lo stesso, marcato", async () => {
    const { useCase, rendered } = setup();
    await useCase.execute(month);
    expect(rendered("report/2026-09/2026-09-lucia.pptx").stato_recap).toBe(RecapStatusLabel.unconfirmed);
  });

  it("chiede all'LLM solo i segnaposto di contenuto, con recap, integrazioni e diari", async () => {
    const { useCase, llm } = setup();
    await useCase.execute(month);
    const request = llm.requests[0]!;
    expect(request.jsonSchema).toEqual(contentJsonSchema(["titolo", "sintesi"]));
    expect(request.system).toContain("Istruzioni report");
    expect(request.prompt).toContain("Integrazione");
    expect(request.prompt).toContain("Diario dopo il recap");
  });

  it("salta chi non ha recap", async () => {
    const { useCase, store } = setup();
    store.texts.delete("recap/2026-09/lucia.md");
    expect((await useCase.execute(month))[1]).toEqual({ person: "lucia", status: "skipped", reason: "no-recap" });
  });

  it("fallisce se la risposta LLM non rispetta i segnaposto", async () => {
    const { useCase, store } = setup(JSON.stringify({ titolo: "solo titolo" }));
    const outcomes = await useCase.execute(month);
    expect(outcomes.every((o) => o.status === "failed")).toBe(true);
    expect(store.binaries.size).toBe(0);
  });
});

describe("monthLabel", () => {
  it("formatta il mese in italiano", () => {
    expect(monthLabel(YearMonth.parse("2026-01"))).toBe("Gennaio 2026");
  });
});
