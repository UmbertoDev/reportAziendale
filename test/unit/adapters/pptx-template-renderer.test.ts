import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { PptxTemplateRenderer } from "../../../src/adapters/pptx/pptx-template-renderer.js";

const run = (text: string) => `<a:r><a:rPr lang="it-IT"/><a:t>${text}</a:t></a:r>`;
const paragraph = (...runs: string[]) => `<a:p><a:pPr marL="1"/>${runs.join("")}</a:p>`;

async function pptxWith(slideBody: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", `<p:sld><p:txBody>${slideBody}</p:txBody></p:sld>`);
  zip.file("ppt/presentation.xml", "<p:presentation/>");
  return zip.generateAsync({ type: "uint8array" });
}

async function slideXml(pptx: Uint8Array): Promise<string> {
  return (await JSZip.loadAsync(pptx)).file("ppt/slides/slide1.xml")!.async("string");
}

const renderer = new PptxTemplateRenderer();

describe("PptxTemplateRenderer", () => {
  it("elenca i segnaposto una sola volta, anche se spezzati tra run", async () => {
    const template = await pptxWith(
      paragraph(run("{{titolo}}")) + paragraph(run("{{ven"), run("ditore}} - {{titolo}}")),
    );
    expect(await renderer.placeholders(template)).toEqual(["titolo", "venditore"]);
  });

  it("sostituisce i valori con escape XML", async () => {
    const template = await pptxWith(paragraph(run("Report {{titolo}}")));
    const xml = await slideXml(await renderer.render(template, { titolo: "A & B <srl>" }));
    expect(xml).toContain("<a:t>Report A &amp; B &lt;srl&gt;</a:t>");
  });

  it("ricompone un segnaposto spezzato tra run", async () => {
    const template = await pptxWith(paragraph(run("{{ven"), run("ditore}}")));
    const xml = await slideXml(await renderer.render(template, { venditore: "Mario" }));
    expect(xml).toContain("<a:t>Mario</a:t>");
    expect(xml).not.toContain("ditore");
  });

  it("un valore su più righe diventa più paragrafi con la stessa formattazione", async () => {
    const template = await pptxWith(paragraph(run("{{punti}}")));
    const xml = await slideXml(await renderer.render(template, { punti: "Uno\n\nDue" }));
    expect(xml.match(/<a:p><a:pPr marL="1"\/>/g)).toHaveLength(2);
    expect(xml).toContain("<a:t>Uno</a:t>");
    expect(xml).toContain("<a:t>Due</a:t>");
  });

  it("dentro una frase le righe vengono unite", async () => {
    const template = await pptxWith(paragraph(run("Nota: {{punti}}")));
    const xml = await slideXml(await renderer.render(template, { punti: "Uno\nDue" }));
    expect(xml).toContain("<a:t>Nota: Uno Due</a:t>");
  });

  it("funziona sul template segnaposto del repo", async () => {
    const template = new Uint8Array(await readFile("templates/report-mensile.pptx"));
    const names = await renderer.placeholders(template);
    expect(names).toEqual(
      expect.arrayContaining(["titolo", "venditore", "mese", "stato_recap", "sintesi", "risultati", "prossimi_passi"]),
    );
    const values = Object.fromEntries(names.map((n) => [n, `valore ${n}`]));
    const output = await renderer.render(template, values);
    expect(await renderer.placeholders(output)).toEqual([]);
  });
});
