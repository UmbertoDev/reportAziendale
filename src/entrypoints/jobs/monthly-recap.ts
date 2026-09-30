import { GenerateMonthlyRecap, type RecapOutcome } from "../../application/generate-monthly-recap.js";
import { createJobContext, runJob } from "./job-context.js";

const describe = (o: RecapOutcome) => ({
  person: o.person,
  status: o.status,
  ...(o.status === "skipped" ? { detail: o.reason } : {}),
  ...(o.status === "failed" ? { detail: o.error } : {}),
});

await runJob("recap-mensile", async () => {
  const ctx = createJobContext();
  const useCase = new GenerateMonthlyRecap(ctx.people, ctx.diaries, ctx.store, ctx.context, ctx.llm(), ctx.clock);
  const outcomes = await useCase.execute(ctx.month, { overwrite: ctx.env.OVERWRITE === "true" });
  return { failed: outcomes.filter((o) => o.status === "failed").length, summary: outcomes.map(describe) };
});
