import { describe, expect, it } from "vitest";
import { MonthlyRecap } from "../../../src/domain/recap.js";
import { YearMonth } from "../../../src/domain/year-month.js";

const month = YearMonth.parse("2026-09");
const proposed = MonthlyRecap.propose("mario", month, "## Sintesi\n\nMese positivo.", new Date("2026-09-25T07:00:00Z"));

describe("MonthlyRecap", () => {
  it("nasce proposto e non confermato", () => {
    expect(proposed.status).toBe("proposto");
    expect(proposed.isConfirmed).toBe(false);
  });

  it("la conferma cambia stato senza toccare il testo", () => {
    const confirmed = proposed.confirm(new Date("2026-09-26T10:00:00Z"));
    expect(confirmed.isConfirmed).toBe(true);
    expect(confirmed.body).toBe(proposed.body);
    expect(proposed.isConfirmed).toBe(false);
  });

  it("l'integrazione conferma e si somma al testo per il report", () => {
    const integrated = proposed
      .integrate("Aggiungo ordine Gamma", new Date("2026-09-26T10:00:00Z"))
      .integrate("E visita Delta", new Date("2026-09-27T10:00:00Z"));
    expect(integrated.isConfirmed).toBe(true);
    expect(integrated.fullText).toContain("- Aggiungo ordine Gamma\n- E visita Delta");
  });

  it("serializza e rilegge senza perdite", () => {
    const original = proposed.integrate("Nota finale\nsu due righe", new Date("2026-09-26T10:00:00Z"));
    const parsed = MonthlyRecap.parse(original.serialize());
    expect(parsed).toEqual(original);
    expect(original.serialize()).toMatch(/^---\npersona: mario\nmese: 2026-09\nstato: confermato\n/);
  });

  it("rifiuta un file senza front matter", () => {
    expect(() => MonthlyRecap.parse("# titolo")).toThrow();
  });
});
