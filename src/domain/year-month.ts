/** Value object: un mese di calendario (es. 2026-09). */
export class YearMonth {
  private constructor(
    readonly year: number,
    readonly month: number,
  ) {}

  static of(year: number, month: number): YearMonth {
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      throw new Error(`Anno non valido: ${year}`);
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(`Mese non valido: ${month}`);
    }
    return new YearMonth(year, month);
  }

  static parse(value: string): YearMonth {
    const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
    if (!match) throw new Error(`Formato mese non valido (atteso YYYY-MM): ${value}`);
    return YearMonth.of(Number(match[1]), Number(match[2]));
  }

  get daysInMonth(): number {
    return new Date(Date.UTC(this.year, this.month, 0)).getUTCDate();
  }

  equals(other: YearMonth): boolean {
    return this.year === other.year && this.month === other.month;
  }

  toString(): string {
    return `${this.year}-${String(this.month).padStart(2, "0")}`;
  }
}
