/** Un venditore registrato che può scrivere al bot. */
export interface Person {
  /** Identificativo breve usato nei nomi file (es. "mario"). */
  readonly slug: string;
  readonly name: string;
  readonly telegramUserId: number;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function assertValidSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Slug persona non valido: "${slug}" (ammessi a-z, 0-9, -)`);
  }
}
