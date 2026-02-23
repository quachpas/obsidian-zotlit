import pLimit from "p-limit";
import type {
  ZoteroApiRegularItem,
  ZoteroApiChildItem,
  ZoteroApiCollection,
  ZoteroApiItem,
  ZoteroApiItemData,
} from "./types.js";

const REQUIRED_HEADER = "Zotero-Allowed-Request";
const CONCURRENCY_LIMIT = 5;

/** Minimal fetch-compatible response shape used by the client. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** A fetch function with the same signature subset used by the client. */
export type FetchFn = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<FetchResponse>;

export interface ZoteroApiClientOptions {
  port?: number;
  apiKey?: string;
  userId?: number;
  /** Override the fetch implementation (e.g. to bypass CORS in Electron). */
  fetchFn?: FetchFn;
}

export class ZoteroLocalApiClient {
  readonly port: number;
  readonly apiKey: string | undefined;
  readonly userId: number;
  readonly #fetch: FetchFn;

  constructor(opts: ZoteroApiClientOptions = {}) {
    this.port = opts.port ?? 23119;
    this.apiKey = opts.apiKey;
    this.userId = opts.userId ?? 0;
    this.#fetch = opts.fetchFn ?? ((url, init) => fetch(url, init));
  }

  get baseUrl(): string {
    return `http://localhost:${this.port}/api/users/${this.userId}`;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      [REQUIRED_HEADER]: "1",
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      h["Zotero-API-Key"] = this.apiKey;
    }
    return h;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.#fetch(
        `${this.baseUrl}/items?limit=1&format=json`,
        { headers: this.headers() },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  private async fetchPage<T>(url: string, start: number, limit: number): Promise<{ total: number; batch: T[] }> {
    const sep = url.includes("?") ? "&" : "?";
    const res = await this.#fetch(`${url}${sep}format=json&include=data&limit=${limit}&start=${start}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Zotero API error ${res.status}: ${await res.text()}`);
    }
    const total = parseInt(res.headers.get("Total-Results") ?? "0", 10);
    const batch = await res.json() as T[];
    return { total, batch };
  }

  private async fetchAll<T>(
    url: string,
    onBatch?: (batch: T[]) => void | Promise<void>
  ): Promise<T[]> {
    const limit = 100;
    // Fetch first page to get total results count
    const { total, batch: firstBatch } = await this.fetchPage<T>(url, 0, limit);
    const results: T[] = [...firstBatch];
    
    if (onBatch) {
      await onBatch(firstBatch);
    }

    if (total <= limit) {
      return results;
    }

    const remainingStarts: number[] = [];
    for (let start = limit; start < total; start += limit) {
      remainingStarts.push(start);
    }

    const fetchLimit = pLimit(CONCURRENCY_LIMIT);
    const remainingBatches = await Promise.all(
      remainingStarts.map((start) => 
        fetchLimit(async () => {
          const { batch } = await this.fetchPage<T>(url, start, limit);
          if (onBatch) {
            await onBatch(batch);
          }
          return batch;
        })
      )
    );

    for (const batch of remainingBatches) {
      results.push(...batch);
    }

    return results;
  }

  /** Fetch all regular items for the user library */
  async getAllItems(
    onBatch?: (batch: ZoteroApiRegularItem[]) => void | Promise<void>
  ): Promise<ZoteroApiRegularItem[]> {
    return this.fetchAll<ZoteroApiRegularItem>(
      `${this.baseUrl}/items?itemType=-attachment&itemType=-annotation&itemType=-note`,
      onBatch,
    );
  }

  /** Fetch a single item by key */
  async getItem(key: string): Promise<ZoteroApiItem<ZoteroApiItemData> | null> {
    const res = await this.#fetch(
      `${this.baseUrl}/items/${key}?format=json&include=data`,
      { headers: this.headers() },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Zotero API error ${res.status}: ${await res.text()}`);
    return res.json() as Promise<ZoteroApiItem<ZoteroApiItemData>>;
  }

  /** Fetch child items (annotations, notes, attachments) of an item */
  async getChildren(itemKey: string, itemType?: string): Promise<ZoteroApiChildItem[]> {
    let url = `${this.baseUrl}/items/${itemKey}/children?format=json&include=data`;
    if (itemType) url += `&itemType=${itemType}`;
    const res = await this.#fetch(
      url,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`Zotero API error ${res.status}: ${await res.text()}`);
    return res.json() as Promise<ZoteroApiChildItem[]>;
  }

  /** Fetch all collections */
  async getCollections(): Promise<ZoteroApiCollection[]> {
    return this.fetchAll<ZoteroApiCollection>(`${this.baseUrl}/collections`);
  }
}
