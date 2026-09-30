import { HttpTelegramApi } from "../../adapters/telegram/telegram-api.js";
import { TelegramRecapNotifier } from "../../adapters/telegram/telegram-recap-notifier.js";
import { SendRecapReminders } from "../../application/send-recap-reminders.js";
import { required } from "../config.js";
import { createJobContext, runJob } from "./job-context.js";

await runJob("promemoria-recap", async () => {
  const ctx = createJobContext();
  const notifier = new TelegramRecapNotifier(new HttpTelegramApi(required(ctx.env, "TELEGRAM_BOT_TOKEN")));
  const outcomes = await new SendRecapReminders(ctx.people, ctx.store, notifier).execute(ctx.month);
  return { failed: outcomes.filter((o) => o.status === "failed").length, summary: outcomes };
});
