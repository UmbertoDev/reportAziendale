/**
 * Genera il template PPTX segnaposto (templates/report-mensile.pptx).
 * Da sostituire con il template aziendale reale: basta che contenga i segnaposto {{nome}}.
 */
import { writeFile } from "node:fs/promises";
import PptxGenJS from "pptxgenjs";

const OUTPUT = process.argv[2] ?? "templates/report-mensile.pptx";
const COLOR = { primary: "1F3A5F", text: "333333", muted: "7A7A7A" };

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.title = "Report mensile venditore";

const titleSlide = pptx.addSlide();
titleSlide.background = { color: COLOR.primary };
titleSlide.addText("{{titolo}}", { x: 0.7, y: 2.2, w: 12, h: 1.2, fontSize: 36, bold: true, color: "FFFFFF" });
titleSlide.addText("{{venditore}} · {{mese}}", { x: 0.7, y: 3.5, w: 12, h: 0.6, fontSize: 20, color: "FFFFFF" });
titleSlide.addText("Stato recap: {{stato_recap}}", { x: 0.7, y: 6.4, w: 12, h: 0.4, fontSize: 12, color: "D0D8E0" });

function contentSlide(title: string, placeholder: string, bullet: boolean) {
  const slide = pptx.addSlide();
  slide.addText(title, { x: 0.7, y: 0.4, w: 12, h: 0.8, fontSize: 28, bold: true, color: COLOR.primary });
  slide.addText(`{{${placeholder}}}`, {
    x: 0.7, y: 1.4, w: 12, h: 5.2, fontSize: 18, color: COLOR.text, valign: "top",
    ...(bullet ? { bullet: true } : {}),
  });
  slide.addText("{{venditore}} · {{mese}}", { x: 0.7, y: 6.9, w: 12, h: 0.3, fontSize: 10, color: COLOR.muted });
}

contentSlide("Sintesi del mese", "sintesi", false);
contentSlide("Attività e risultati", "risultati", true);
contentSlide("Clienti e opportunità", "clienti_opportunita", true);
contentSlide("Criticità", "criticita", true);
contentSlide("Prossimi passi", "prossimi_passi", true);

const data = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
await writeFile(OUTPUT, data);
console.log(`Template scritto in ${OUTPUT}`);
