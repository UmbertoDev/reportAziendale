import type { GithubStoreConfig } from "../adapters/github/github-contents-store.js";

export type Env = Record<string, string | undefined>;

export function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}

export const DEFAULT_TIME_ZONE = "Europe/Rome";
export const DEFAULT_DATA_BRANCH = "data";

/** Configurazione del repo dati: DATA_REPO = "owner/repo", DATA_BRANCH, GITHUB_TOKEN. */
export function githubStoreConfig(env: Env): GithubStoreConfig {
  const [owner, repo] = required(env, "DATA_REPO").split("/");
  if (!owner || !repo) throw new Error("DATA_REPO deve essere nel formato owner/repo");
  return {
    owner,
    repo,
    branch: env.DATA_BRANCH?.trim() || DEFAULT_DATA_BRANCH,
    token: required(env, "GITHUB_TOKEN"),
    committer: { name: "report-aziendale-bot", email: "report-aziendale-bot@users.noreply.github.com" },
  };
}

export const timeZoneOf = (env: Env): string => env.TIMEZONE?.trim() || DEFAULT_TIME_ZONE;
