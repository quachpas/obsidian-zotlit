import type { RegularItemInfo } from "@obzt/database";
import type { SimpleDocumentSearchResultSetUnit } from "@obzt/database/api";
import { Service } from "@ophidian/core";
import log from "@/log";
import { SettingsService } from "@/settings/base";
import DatabaseWatcher from "./auto-refresh/service";
import DatabaseWorker, { DatabaseStatus } from "./connector/service";

export class ZoteroDatabase extends Service {
  // async onload() {}

  onunload(): void {
    log.info("ZoteroDB unloaded");
  }

  get defaultLibId() {
    return this.settings.libId;
  }

  settings = this.use(SettingsService);
  #worker = this.use(DatabaseWorker);

  watcher = this.use(DatabaseWatcher);
  get api() {
    return this.#worker.api;
  }

  async search(query: string): Promise<SearchResult[]> {
    const limit = 50,
      lib = this.defaultLibId;

    if (this.#worker.status !== DatabaseStatus.Ready)
      throw new Error("Search index not ready");
    const result = await this.api.search(lib, {
      query,
      limit,
      index: matchFields,
    });
    if (result.length === 0) return [];
    const sorted = sort(result);
    if (sorted.length === 0) return [];
    const items = await this.api.getItems(sorted.map((i) => [i.id, lib]));

    return items.map((item, index) => {
      const { id, fields, score } = sorted[index];
      if (!item) throw new Error("Item not found: " + id);
      return { item, score, fields: [...fields] };
    });
  }
  async getItemsOf(
    limit = 50,
    lib = this.defaultLibId,
  ): Promise<SearchResult[]> {
    if (this.#worker.status !== DatabaseStatus.Ready)
      throw new Error("Search index not ready");
    const result = await this.api.getItemsFromCache(limit, lib);
    return result.map((item) => ({ item, score: -1, fields: [] }));
  }
}

interface SearchResultRaw {
  id: number;
  score: number;
  fields: Set<string>;
}

export interface SearchResult {
  item: RegularItemInfo;
  score: number;
  fields: string[];
}

const matchFields: string[] = [
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

function sort(resultSet: SimpleDocumentSearchResultSetUnit[]) {
  const { size } = new Set(resultSet.flatMap((r) => r.result));
  const items = resultSet.reduce((idScore, { field, result }) => {
    let normalizedField = field;
    if (normalizedField.startsWith("creators[]")) {
      normalizedField = "creators";
    }
    result.forEach((id, index) => {
      let score = size - index;
      switch (normalizedField) {
        case "title":
          score *= 10;
          break;
        case "citekey":
          score *= 8;
          break;
        case "creators":
          score *= 5;
          break;
        case "publicationTitle":
        case "proceedingsTitle":
        case "conferenceName":
          score *= 2;
          break;
        case "date":
        case "journalAbbreviation":
        case "shortTitle":
        case "series":
        case "seriesTitle":
        case "publisher":
        case "university":
        case "institution":
          score *= 1;
          break;
        default:
          // Ignore unknown fields instead of throwing error to be more robust
          log.warn("Unknown field in search results: " + field);
          score *= 0.5;
          break;
      }

      if (!idScore.has(+id)) {
        idScore.set(+id, { id: +id, score, fields: new Set([normalizedField]) });
      } else {
        const scoreObj = idScore.get(+id)!;
        scoreObj.fields.add(normalizedField);
        scoreObj.score += score;
      }
    });
    return idScore;
  }, new Map<number, SearchResultRaw>());
  return Array.from(items.values()).sort((a, b) => b.score - a.score);
}
