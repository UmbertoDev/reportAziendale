import { YearMonth } from "./year-month.js";

/** Data e ora "da muro" in un fuso orario, senza dipendenze da librerie esterne. */
export class LocalDateTime {
  private constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
    readonly hour: number,
    readonly minute: number,
  ) {}

  static from(instant: Date, timeZone: string): LocalDateTime {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const get = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((p) => p.type === type)?.value);
    return new LocalDateTime(get("year"), get("month"), get("day"), get("hour"), get("minute"));
  }

  get yearMonth(): YearMonth {
    return YearMonth.of(this.year, this.month);
  }

  get isLastDayOfMonth(): boolean {
    return this.day === this.yearMonth.daysInMonth;
  }

  /** YYYY-MM-DD */
  get isoDate(): string {
    return `${this.yearMonth.toString()}-${pad(this.day)}`;
  }

  /** HH:MM */
  get time(): string {
    return `${pad(this.hour)}:${pad(this.minute)}`;
  }
}

const pad = (n: number): string => String(n).padStart(2, "0");
