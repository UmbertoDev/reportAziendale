import { DEFAULT_TEMPLATE_PATH, FsTemplateSource } from "../../adapters/pptx/fs-template-source.js";
import { PptxTemplateRenderer } from "../../adapters/pptx/pptx-template-renderer.js";
import { BuildMonthlyReport, type ReportOutcome } from "../../application/build-monthly-report.js";
import { createJobContext, runJob } from "./job-context.js";

const describe = (o: ReportOutcome) => ({
  person: o.person,
  status: o.status,
  ...(o.status === "generated" ? { detail: `${o.path}${o.recapConfirmed ? "" : " (recap non confermato)"}` } : {}),
  ...(o.status === "skipped" ? { detail: o.reason } : {}),
  ...(o.status === "failed" ? { detail: o.error } : {}),
});

await runJob("report-mensile", async () => {
  const ctx = createJobContext();
  // Il cron gira dal 28 al 31: si procede solo l'ultimo giorno, salvo mese esplicito (esecuzione manuale).
  if (!ctx.env.MONTH?.trim() && !ctx.today.isLastDayOfMonth) {
    return { failed: 0, summary: `Oggi (${ctx.today.isoDate}) non è l'ultimo giorno del mese: nulla da fare.` };
  }
  const useCase = new BuildMonthlyReport(
    ctx.people,
    ctx.diaries,
    ctx.store,
    ctx.context,
    ctx.llm(),
    new FsTemplateSource(ctx.env.REPORT_TEMPLATE?.trim() || DEFAULT_TEMPLATE_PATH),
    new PptxTemplateRenderer(),
  );
  const outcomes = await useCase.execute(ctx.month);
  return { failed: outcomes.filter((o) => o.status === "failed").length, summary: outcomes.map(describe) };
});
