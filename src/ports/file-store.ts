/**
 * Archivio file versionato (il repo dati). Ogni scrittura è un commit.
 * `update` applica una trasformazione con concorrenza ottimistica:
 * l'implementazione rilegge e riprova se il file è cambiato nel frattempo.
 */
export interface FileStore {
  readText(path: string): Promise<string | null>;
  updateText(path: string, transform: (current: string | null) => string, message: string): Promise<void>;
  writeBinary(path: string, content: Uint8Array, message: string): Promise<void>;
  /** Percorsi completi dei file (non ricorsivo) nella cartella; [] se non esiste. */
  list(dir: string): Promise<string[]>;
}
