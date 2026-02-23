import type {
  AnnotationInfo,
  AttachmentInfo,
  Collection,
  KeyLibID,
  LibraryInfo,
  NoteInfo,
  RegularItemInfo,
  TagInfo,
} from "@obzt/database";
import { getItemKeyGroupID } from "@obzt/common";
import { getItemKeyGroupID as _gkg } from "@obzt/common";
import {
  ZoteroLocalApiClient,
  apiItemToRegularItemInfo,
  apiCollectionToCollection,
  apiAttachmentToAttachmentInfo,
  apiAnnotationToAnnotationInfo,
  apiNoteToNoteInfo,
  isAnnotationData,
  isNoteData,
  isAttachmentData,
} from "@obzt/zotero-api";
import type {
  ZoteroApiCollection,
} from "@obzt/zotero-api";
import type {
  DocumentSearchOptions,
  SimpleDocumentSearchResultSetUnit,
} from "flexsearch";
import Document from "flexsearch/src/document";
import language from "flexsearch/src/lang/en.js";
import charset from "flexsearch/src/lang/latin/default.js";
import { Service } from "@ophidian/core";
import { App, Notice, requestUrl } from "obsidian";
import log from "@/log";
import type { FetchFn } from "@obzt/zotero-api";

/**
 * Adapter that delegates to Obsidian's `requestUrl`, which uses Electron's
 * Node.js networking stack and is not subject to browser CORS restrictions.
 */
const obsidianFetch: FetchFn = async (url, init) => {
  const res = await requestUrl({
    url,
    headers: init.headers,
    throw: false,
  });
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    headers: {
      get: (name: string) => res.headers[name.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(res.json),
    text: () => Promise.resolve(res.text),
  };
};

const INDEX_FIELDS = [
  "title",
  "creators[]:firstName",
  "creators[]:lastName",
  "date",
  "citekey",
  "publicationTitle",
  "proceedingsTitle",
  "journalAbbreviation",
  "shortTitle",
  "series",
  "seriesTitle",
  "publisher",
  "university",
  "institution",
  "conferenceName",
];

export class ZoteroApiService extends Service {
  app = this.use(App);

  #client: ZoteroLocalApiClient = new ZoteroLocalApiClient({ fetchFn: obsidianFetch });

  /** key → item, per library */
  #itemCache = new Map<number, Map<string, RegularItemInfo>>();

  /** citekey → item key, per library */
  #citekeyCache = new Map<number, Map<string, string>>();

  /** annotation key → tags (populated when annotations are fetched) */
  #annotTagsCache = new Map<string, TagInfo[]>();

  #libraries: LibraryInfo[] = [];
  #collectionsMap = new Map<string, Collection>();

  #search = new Document<RegularItemInfo, true>({
    worker: false,
    charset,
    language,
    document: {
      id: "key",
      index: INDEX_FIELDS,
    },
    tokenize: "full",
    // @ts-ignore
    suggest: true,
  });

  #indexedLibrary: number | null = null;

  onload() {
    log.debug("loading ZoteroApiService");
  }

  onunload() {
    this.#itemCache.clear();
    this.#citekeyCache.clear();
    this.#annotTagsCache.clear();
    this.#collectionsMap.clear();
    this.#libraries = [];
    this.#indexedLibrary = null;
  }

  #rebuildClient() {
    this.#client = new ZoteroLocalApiClient({
      fetchFn: obsidianFetch,
    });
  }

  /** Verify the API is reachable */
  async connect(): Promise<boolean> {
    this.#rebuildClient();
    return this.#client.ping();
  }

  /** Load all items from the API and build the in-memory index */
  async loadAllItems(libraryID: number): Promise<void> {
    log.debug("Loading all items from Zotero API...");

    // Load collections first for path resolution
    const apiCollections = await this.#client.getCollections();
    this.#collectionsMap.clear();
    for (const col of apiCollections) {
      const collection = apiCollectionToCollection(col, apiCollections);
      this.#collectionsMap.set(col.data.key, collection);
    }

    const libCache = new Map<string, RegularItemInfo>();
    const citekeyMap = new Map<string, string>();
    this.#itemCache.set(libraryID, libCache);
    this.#citekeyCache.set(libraryID, citekeyMap);

    // Load all regular items with streaming
    let isFirstBatch = true;
    await this.#client.getAllItems(async (batch) => {
      for (const apiItem of batch) {
        const { itemType } = apiItem.data;
        if (
          itemType === "attachment" ||
          itemType === "annotation" ||
          itemType === "note"
        ) {
          continue;
        }
        const item = apiItemToRegularItemInfo(apiItem, this.#collectionsMap);
        libCache.set(item.key, item);
        if (item.citekey) {
          citekeyMap.set(item.citekey, item.key);
        }
        await this.#search.addAsync(item.key, item);
      }
      if (isFirstBatch) {
        this.app.metadataCache.trigger("zotero:search-ready");
        isFirstBatch = false;
      }
    });

    log.info(`Loaded ${libCache.size} items from Zotero API`);

    // Set up libraries info
    this.#libraries = [
      { libraryID, groupID: null, name: "My Library" },
    ];

    this.#indexedLibrary = libraryID;
    log.debug("Zotero API item cache loaded and indexed");
  }

  /** Build (or rebuild) the FlexSearch index for a library */
  async initIndex(libraryID: number): Promise<void> {
    if (this.#indexedLibrary === libraryID) return;
    // If not indexed during loadAllItems, build it now
    const cache = this.#itemCache.get(libraryID);
    if (!cache) {
      throw new Error(`No item cache for library ${libraryID}`);
    }
    log.debug(`Building FlexSearch index for library ${libraryID}...`);
    await Promise.all(
      [...cache.values()].map((item) => this.#search.addAsync(item.key, item)),
    );
    this.#indexedLibrary = libraryID;
    log.info(`FlexSearch index built for library ${libraryID}`);
  }

  /** Update a single item in the cache and index */
  async updateItem(key: string, libraryID: number): Promise<RegularItemInfo | null> {
    const apiItem = await this.#client.getItem(key);
    if (
      !apiItem ||
      apiItem.data.itemType === "attachment" ||
      apiItem.data.itemType === "annotation" ||
      apiItem.data.itemType === "note"
    ) {
      await this.removeItem(key, libraryID);
      return null;
    }
    const item = apiItemToRegularItemInfo(apiItem as any, this.#collectionsMap);
    const libCache = this.#itemCache.get(libraryID);
    if (libCache) {
      libCache.set(key, item);
      if (item.citekey) {
        this.#citekeyCache.get(libraryID)?.set(item.citekey, key);
      }
    }
    await this.#search.updateAsync(item.key, item);
    return item;
  }

  /** Remove an item from cache and index */
  async removeItem(key: string, libraryID: number): Promise<void> {
    const libCache = this.#itemCache.get(libraryID);
    if (libCache) {
      const item = libCache.get(key);
      if (item?.citekey) {
        this.#citekeyCache.get(libraryID)?.delete(item.citekey);
      }
      libCache.delete(key);
    }
    await this.#search.removeAsync(key);
  }

  // ── DbWorkerAPI-compatible surface ──────────────────────────────────────

  getLibs(): LibraryInfo[] {
    return this.#libraries;
  }

  async search(
    libraryID: number,
    options: Partial<DocumentSearchOptions<false>>,
  ): Promise<SimpleDocumentSearchResultSetUnit[]> {
    return this.#search.searchAsync(options);
  }

  async getItems(
    items: KeyLibID[],
    forceUpdate = false,
  ): Promise<(RegularItemInfo | null)[]> {
    return Promise.all(
      items.map(async ([key, lib]) => {
        if (!forceUpdate) {
          const cached = this.#itemCache.get(lib)?.get(key);
          if (cached) return cached;
        }
        return this.updateItem(key, lib);
      }),
    );
  }

  async getItemsFromCache(limit: number, lib: number): Promise<RegularItemInfo[]> {
    const cache = this.#itemCache.get(lib);
    if (!cache) return [];
    const items = [...cache.values()].sort((a, b) =>
      b.dateAccessed && a.dateAccessed
        ? b.dateAccessed.getTime() - a.dateAccessed.getTime()
        : 0,
    );
    return limit > 0 ? items.slice(0, limit) : items;
  }

  #cacheAnnotTags(key: string, apiTags: Array<{ tag: string; type?: number }> | undefined) {
    this.#annotTagsCache.set(key, (apiTags ?? []).map((t) => ({
      tagID: 0,
      type: t.type ?? 0,
      name: t.tag,
    })));
  }

  async getAnnotations(attachmentKey: string, libraryID: number): Promise<AnnotationInfo[]> {
    const children = await this.#client.getChildren(attachmentKey, "annotation");
    return children
      .filter((c) => isAnnotationData(c.data as any))
      .map((c) => {
        const annot = apiAnnotationToAnnotationInfo(c as any, attachmentKey);
        this.#cacheAnnotTags(annot.key, (c.data as any).tags);
        return annot;
      });
  }

  async getAnnotFromKey(
    keys: string[],
    libraryID: number,
  ): Promise<Record<string, AnnotationInfo>> {
    const result: Record<string, AnnotationInfo> = {};
    await Promise.all(
      keys.map(async (key) => {
        const apiItem = await this.#client.getItem(key);
        if (!apiItem || apiItem.data.itemType !== "annotation") return;
        const parentKey = (apiItem.data as any).parentItem ?? "";
        const annot = apiAnnotationToAnnotationInfo(apiItem as any, parentKey);
        result[key] = annot;
        this.#cacheAnnotTags(key, (apiItem.data as any).tags);
      }),
    );
    return result;
  }

  async getAttachments(docKey: string, libraryID: number): Promise<AttachmentInfo[]> {
    const children = await this.#client.getChildren(docKey, "attachment");
    return children
      .filter((c) => isAttachmentData(c.data as any))
      .map((c) => apiAttachmentToAttachmentInfo(c as any));
  }

  async getNotes(itemKey: string, libraryID: number): Promise<NoteInfo[]> {
    const children = await this.#client.getChildren(itemKey, "note");
    return children
      .filter((c) => isNoteData(c.data as any))
      .map((c) => apiNoteToNoteInfo(c as any));
  }

  async getNoteFromKey(
    keys: string[],
    libraryID: number,
  ): Promise<Record<string, NoteInfo>> {
    const result: Record<string, NoteInfo> = {};
    await Promise.all(
      keys.map(async (key) => {
        const apiItem = await this.#client.getItem(key);
        if (!apiItem || apiItem.data.itemType !== "note") return;
        result[key] = apiNoteToNoteInfo(apiItem as any);
      }),
    );
    return result;
  }

  getTags(items: KeyLibID[]): Record<string, TagInfo[]> {
    const result: Record<string, TagInfo[]> = {};
    for (const [key, lib] of items) {
      // Check annotation tag cache first (populated by getAnnotations/getAnnotFromKey)
      if (this.#annotTagsCache.has(key)) {
        result[key] = this.#annotTagsCache.get(key)!;
        continue;
      }
      // Then check regular item cache
      const item = this.#itemCache.get(lib)?.get(key);
      if (!item) {
        result[key] = [];
        continue;
      }
      const tags = (item as any).tags as Array<{ tag: string; type?: number }> | undefined;
      result[key] = (tags ?? []).map((t) => ({
        tagID: 0,
        type: t.type ?? 0,
        name: t.tag,
      }));
    }
    return result;
  }

  /** Look up item key(s) by citekey */
  getItemKeyFromCitekey(
    citekeys: string[],
    libraryID: number,
  ): Record<string, string> {
    const citekeyMap = this.#citekeyCache.get(libraryID);
    const result: Record<string, string> = {};
    for (const ck of citekeys) {
      const key = citekeyMap?.get(ck);
      if (key) result[ck] = key;
    }
    return result;
  }

  /** Check if the service has items loaded */
  get isReady(): boolean {
    return this.#itemCache.size > 0;
  }
}
