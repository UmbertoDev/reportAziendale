/** Motore di rendering del template di presentazione (PPTX). */
export interface PresentationRenderer {
  /** Nomi dei segnaposto {{nome}} presenti nel template, senza duplicati. */
  placeholders(template: Uint8Array): Promise<string[]>;
  render(template: Uint8Array, values: Readonly<Record<string, string>>): Promise<Uint8Array>;
}

/** Sorgente del template preconfigurato. */
export interface TemplateSource {
  load(): Promise<Uint8Array>;
}
