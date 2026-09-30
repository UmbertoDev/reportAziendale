import { JsonPeopleDirectory } from "../../adapters/config/json-people-directory.js";
import { GithubContentsStore } from "../../adapters/github/github-contents-store.js";
import { IntegrationReplyHandler } from "../../adapters/telegram/handlers/integration-reply-handler.js";
import { RecapCallbackHandler } from "../../adapters/telegram/handlers/recap-callback-handler.js";
import { DiaryMessageHandler } from "../../adapters/telegram/handlers/diary-message-handler.js";
import { StartCommandHandler } from "../../adapters/telegram/handlers/start-command-handler.js";
import { HttpTelegramApi, type TelegramApi } from "../../adapters/telegram/telegram-api.js";
import { UpdateDispatcher } from "../../adapters/telegram/update-dispatcher.js";
import { AppendMessageToDiary } from "../../application/append-message-to-diary.js";
import { ReviewRecap } from "../../application/review-recap.js";
import { systemClock, type Clock } from "../../ports/clock.js";
import type { FileStore } from "../../ports/file-store.js";
import { githubStoreConfig, required, timeZoneOf, type Env } from "../config.js";

export interface BotDependencies {
  store: FileStore;
  telegram: TelegramApi;
  clock: Clock;
  timeZone: string;
}

export interface Bot {
  dispatcher: UpdateDispatcher;
  telegram: TelegramApi;
}

/** Composition root del bot: l'ordine dei gestori è la priorità. */
export function createBot(deps: BotDependencies): Bot {
  const people = new JsonPeopleDirectory(deps.store);
  const appendMessage = new AppendMessageToDiary(people, deps.store, deps.clock, deps.timeZone);
  const review = new ReviewRecap(people, deps.store, deps.clock);

  const dispatcher = new UpdateDispatcher([
    new StartCommandHandler(deps.telegram),
    new RecapCallbackHandler(review, deps.telegram),
    new IntegrationReplyHandler(review, deps.telegram),
    new DiaryMessageHandler(appendMessage, deps.telegram),
  ]);
  return { dispatcher, telegram: deps.telegram };
}

export function createBotFromEnv(env: Env, fetchFn: typeof fetch = fetch): Bot {
  return createBot({
    store: new GithubContentsStore(githubStoreConfig(env), fetchFn),
    telegram: new HttpTelegramApi(required(env, "TELEGRAM_BOT_TOKEN"), fetchFn),
    clock: systemClock,
    timeZone: timeZoneOf(env),
  });
}
