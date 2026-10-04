import { describe, expect, it } from "vitest";
import { GithubApiError, GithubContentsStore } from "../../../src/adapters/github/github-contents-store.js";
import { base64ToUtf8, utf8ToBase64 } from "../../../src/shared/base64.js";

interface Call {
  method: string;
  url: string;
  body?: Record<string, unknown>;
}

/** Fetch finto programmabile: una risposta per chiamata, in ordine. */
function scriptedFetch(responses: Response[]) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? "GET",
      url: String(input),
      ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
    });
    const next = responses.shift();
    if (!next) throw new Error("Nessuna risposta programmata");
    return next;
  }) as typeof fetch;
  return { fn, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const file = (text: string, sha = "sha1") => json({ type: "file", sha, path: "x", content: utf8ToBase64(text) });

const config = { owner: "o", repo: "r", branch: "data", token: "t" };
const noWait = { sleep: async () => undefined };

describe("GithubContentsStore", () => {
  it("legge un file di testo dal branch dati", async () => {
    const { fn, calls } = scriptedFetch([file("ciao è")]);
    const store = new GithubContentsStore(config, fn);

    expect(await store.readText("diario/a b.md")).toBe("ciao è");
    expect(calls[0]!.url).toBe("https://api.github.com/repos/o/r/contents/diario/a%20b.md?ref=data");
  });

  it("restituisce null per file inesistente", async () => {
    const { fn } = scriptedFetch([new Response("", { status: 404 })]);
    expect(await new GithubContentsStore(config, fn).readText("x.md")).toBeNull();
  });

  it("crea un file nuovo senza sha", async () => {
    const { fn, calls } = scriptedFetch([new Response("", { status: 404 }), json({}, 201)]);
    await new GithubContentsStore(config, fn).updateText("x.md", (c) => `${c ?? ""}nuovo`, "msg");

    const put = calls[1]!;
    expect(put.method).toBe("PUT");
    expect(put.body).toMatchObject({ message: "msg", branch: "data" });
    expect(put.body).not.toHaveProperty("sha");
    expect(base64ToUtf8(put.body!.content as string)).toBe("nuovo");
  });

  it("su conflitto rilegge e riapplica la trasformazione", async () => {
    const { fn, calls } = scriptedFetch([
      file("A", "sha1"),
      json({ message: "sha mismatch" }, 409),
      file("A+B", "sha2"),
      json({}, 200),
    ]);
    const store = new GithubContentsStore(config, fn, noWait);

    await store.updateText("x.md", (c) => `${c}+C`, "msg");

    const lastPut = calls[3]!;
    expect(lastPut.body!.sha).toBe("sha2");
    expect(base64ToUtf8(lastPut.body!.content as string)).toBe("A+B+C");
  });

  it("non ritenta errori non recuperabili", async () => {
    const { fn } = scriptedFetch([file("A"), json({ message: "no" }, 403)]);
    await expect(new GithubContentsStore(config, fn, noWait).updateText("x.md", (c) => `${c}!`, "m")).rejects.toBeInstanceOf(
      GithubApiError,
    );
  });

  it("non crea commit se il contenuto non cambia", async () => {
    const { fn, calls } = scriptedFetch([file("A")]);
    await new GithubContentsStore(config, fn).updateText("x.md", (c) => c!, "m");
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
  });

  it("elenca solo i file di una cartella", async () => {
    const { fn } = scriptedFetch([
      json([
        { type: "file", path: "d/b.md" },
        { type: "dir", path: "d/sub" },
        { type: "file", path: "d/a.md" },
      ]),
    ]);
    expect(await new GithubContentsStore(config, fn).list("d")).toEqual(["d/a.md", "d/b.md"]);
  });
});
