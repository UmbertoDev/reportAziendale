/** File di contesto e istruzioni (skill) che guidano l'LLM, versionati con il codice. */
export interface ContextRepository {
  /** Contenuto del documento `name` (es. "azienda.md"); stringa vuota se assente. */
  read(name: string): Promise<string>;
}

export const ContextDocuments = {
  company: "azienda.md",
  recapInstructions: "istruzioni-recap.md",
  reportInstructions: "istruzioni-report.md",
} as const;
