import { describe, expect, it } from "vitest";
import { DataLayout } from "../../../src/domain/data-layout.js";
import { DiaryFormatter } from "../../../src/domain/diary.js";
import { LocalDateTime } from "../../../src/domain/local-date-time.js";
import { MARIO } from "../../support/fakes.js";

const at = LocalDateTime.from(new Date("2026-09-30T08:15:00Z"), "Europe/Rome");

describe("DataLayout", () => {
  it("colloca il diario per mese, giorno e persona", () => {
    expect(DataLayout.diaryFile(MARIO, at)).toBe("diario/2026-09/2026-09-30-mario.md");
    expect(DataLayout.isDiaryFileOf("diario/2026-09/2026-09-30-mario.md", MARIO)).toBe(true);
    expect(DataLayout.isDiaryFileOf("diario/2026-09/2026-09-30-marione.md", MARIO)).toBe(false);
  });
});

describe("DiaryFormatter", () => {
  it("crea il file con intestazione alla prima voce", () => {
    const content = DiaryFormatter.append(null, { person: MARIO, at, text: "  Visita cliente Alfa  " });
    expect(content).toBe("# Diario 2026-09-30 - Mario Rossi\n\n## 10:15\n\nVisita cliente Alfa\n");
  });

  it("accoda le voci successive", () => {
    const first = DiaryFormatter.append(null, { person: MARIO, at, text: "Uno" });
    const second = DiaryFormatter.append(first, { person: MARIO, at, text: "Due" });
    expect(second).toBe("# Diario 2026-09-30 - Mario Rossi\n\n## 10:15\n\nUno\n\n## 10:15\n\nDue\n");
  });
});
