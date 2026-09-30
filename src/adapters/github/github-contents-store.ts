import type { FileStore } from "../../ports/file-store.js";
import { base64ToUtf8, bytesToBase64, utf8ToBase64 } from "../../shared/base64.js";
import { withRetry, type RetryPolicy } from "../../shared/retry.js";

export interface GithubStoreConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  apiBaseUrl?: string;
  committer?: { name: string; email: string };
}

export class GithubApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GithubApiError";
  }

  /** 409/422 = SHA non più attuale: un altro commit è arrivato prima. */
  get isConflict(): boolean {
    return this.status === 409 || this.status === 422;
  }
}

interface ContentFile {
  type: "file";
  sha: string;
  content?: string;
  path: string;
}

interface ContentEntry {
  type: string;
  path: string;
}

/**
 * Adapter FileStore sull'API GitHub "contents": un commit per scrittura,
 * nessun clone. Funziona sia nel Worker sia in Node.
 */
export class GithubContentsStore implements FileStore {
  private readonly baseUrl: string;
  private readonly retry: RetryPolicy;

  constructor(
    private readonly config: GithubStoreConfig,
    private readonly fetchFn: typeof fetch = fetch,
    retry?: Partial<RetryPolicy>,
  ) {
    this.baseUrl = `${config.apiBaseUrl ?? "https://api.github.com"}/repos/${config.owner}/${config.repo}/contents`;
    this.retry = {
      attempts: 5,
      baseDelayMs: 300,
      isRetryable: (e) => e instanceof GithubApiError && (e.isConflict || e.status >= 500),
      ...retry,
    };
  }

  async readText(path: string): Promise<string | null> {
    const file = await this.getFile(path);
    return file?.content === undefined ? null : base64ToUtf8(file.content);
  }

  updateText(path: string, transform: (current: string | null) => string, message: string): Promise<void> {
    return withRetry(async () => {
      const file = await this.getFile(path);
      const current = file?.content === undefined ? null : base64ToUtf8(file.content);
      await this.put(path, utf8ToBase64(transform(current)), message, file?.sha);
    }, this.retry);
  }

  writeBinary(path: string, content: Uint8Array, message: string): Promise<void> {
    return withRetry(async () => {
      const file = await this.getFile(path);
      await this.put(path, bytesToBase64(content), message, file?.sha);
    }, this.retry);
  }

  async list(dir: string): Promise<string[]> {
    const body = await this.get(dir);
    if (!Array.isArray(body)) return [];
    return (body as ContentEntry[]).filter((e) => e.type === "file").map((e) => e.path).sort();
  }

  private async getFile(path: string): Promise<ContentFile | null> {
    const body = await this.get(path);
    if (body === null) return null;
    if (Array.isArray(body) || (body as ContentFile).type !== "file") {
      throw new Error(`Il percorso non è un file: ${path}`);
    }
    return body as ContentFile;
  }

  private async get(path: string): Promise<unknown> {
    const url = `${this.baseUrl}/${encodePath(path)}?ref=${encodeURIComponent(this.config.branch)}`;
    const response = await this.fetchFn(url, { headers: this.headers() });
    if (response.status === 404) return null;
    await this.ensureOk(response, `GET ${path}`);
    return response.json();
  }

  private async put(path: string, base64: string, message: string, sha?: string): Promise<void> {
    const response = await this.fetchFn(`${this.baseUrl}/${encodePath(path)}`, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: base64,
        branch: this.config.branch,
        ...(sha ? { sha } : {}),
        ...(this.config.committer ? { committer: this.config.committer } : {}),
      }),
    });
    await this.ensureOk(response, `PUT ${path}`);
  }

  private headers(): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.config.token}`,
      "User-Agent": "report-aziendale-bot",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private async ensureOk(response: Response, operation: string): Promise<void> {
    if (response.ok) return;
    const detail = await response.text().catch(() => "");
    throw new GithubApiError(response.status, `${operation} fallita (${response.status}): ${detail.slice(0, 300)}`);
  }
}

const encodePath = (path: string): string => path.split("/").map(encodeURIComponent).join("/");
