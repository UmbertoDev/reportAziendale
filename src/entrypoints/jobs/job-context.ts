import { resolve } from "node:path";
import { FsContextRepository } from "../../adapters/config/fs-context-repository.js";
import { JsonPeopleDirectory } from "../../adapters/config/json-people-directory.js";
import { GithubContentsStore } from "../../adapters/github/github-contents-store.js";
import { createLlmClient } from "../../adapters/llm/llm-client-factory.js";
import { DiaryReader } from "../../application/diary-reader.js";
import { LocalDateTime } from "../../domain/local-date-time.js";
import { YearMonth } from "../../domain/year-month.js";
import { systemClock } from "../../ports/clock.js";
import { githubStoreConfig, timeZoneOf, type Env } from "../config.js";

/** Dipendenze comuni ai job schedulati (GitHub Actions). */
export function createJobContext(env: Env = process.env) {
  const store = new GithubContentsStore(githubStoreConfig(env));
  const timeZone = timeZoneOf(env);
  const today = LocalDateTime.from(systemClock.now(), timeZone);
  return {
    env,
    store,
    timeZone,
    today,
    clock: systemClock,
    people: new JsonPeopleDirectory(store),
    diaries: new DiaryReader(store),
    context: new FsContextRepository(resolve(env.CONTEXT_DIR ?? "context")),
    llm: () => createLlmClient(env),
    /** Mese da elaborare: MONTH=YYYY-MM se impostato (esecuzione manuale), altrimenti il mese corrente. */
    month: env.MONTH?.trim() ? YearMonth.parse(env.MONTH) : today.yearMonth,
  };
}

export type JobContext = ReturnType<typeof createJobContext>;

/** Esegue il job, stampa l'esito e imposta il codice di uscita. */
export async function runJob(name: string, job: () => Promise<{ failed: number; summary: unknown }>): Promise<void> {
  try {
    const { failed, summary } = await job();
    console.log(`[${name}]`, JSON.stringify(summary, null, 2));
    if (failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`[${name}] errore`, error);
    process.exitCode = 1;
  }
}
