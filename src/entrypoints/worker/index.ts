import { required, type Env } from "../config.js";
import { createBotFromEnv } from "./bot-factory.js";
import { handleWebhook } from "./webhook-handler.js";

/** Cloudflare Worker: endpoint webhook del bot Telegram. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname !== "/telegram/webhook") return new Response("Not Found", { status: 404 });
    return handleWebhook(request, createBotFromEnv(env), required(env, "TELEGRAM_WEBHOOK_SECRET"));
  },
};
