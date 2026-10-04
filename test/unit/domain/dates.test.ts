import { describe, expect, it } from "vitest";
import { LocalDateTime } from "../../../src/domain/local-date-time.js";
import { YearMonth } from "../../../src/domain/year-month.js";

describe("YearMonth", () => {
  it("parsa e formatta YYYY-MM", () => {
    expect(YearMonth.parse("2026-09").toString()).toBe("2026-09");
  });

  it.each(["2026-9", "26-09", "2026-13", "abc"])("rifiuta %s", (value) => {
    expect(() => YearMonth.parse(value)).toThrow();
  });

  it.each([
    ["2026-02", 28],
    ["2028-02", 29],
    ["2026-09", 30],
    ["2026-12", 31],
  ])("%s ha %i giorni", (value, days) => {
    expect(YearMonth.parse(value).daysInMonth).toBe(days);
  });
});

describe("LocalDateTime", () => {
  it("converte l'istante UTC nel giorno locale di Roma", () => {
    // 22:30 UTC del 30/09 = 00:30 del 01/10 a Roma (ora legale)
    const local = LocalDateTime.from(new Date("2026-09-30T22:30:00Z"), "Europe/Rome");
    expect(local.isoDate).toBe("2026-10-01");
    expect(local.time).toBe("00:30");
  });

  it("riconosce l'ultimo giorno del mese", () => {
    expect(LocalDateTime.from(new Date("2026-09-30T10:00:00Z"), "Europe/Rome").isLastDayOfMonth).toBe(true);
    expect(LocalDateTime.from(new Date("2026-09-29T10:00:00Z"), "Europe/Rome").isLastDayOfMonth).toBe(false);
    expect(LocalDateTime.from(new Date("2028-02-29T10:00:00Z"), "Europe/Rome").isLastDayOfMonth).toBe(true);
  });
});
