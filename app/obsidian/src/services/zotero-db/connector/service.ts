/* eslint-disable @typescript-eslint/naming-convention */
import type { INotifyRegularItem } from "@obzt/protocol";
import { Service, calc, effect } from "@ophidian/core";
import { assertNever } from "assert-never";
import type { Plugin } from "obsidian";
import { App, debounce, Notice } from "obsidian";
import log from "@/log";
import { Server } from "@/services/server/service";
import { SettingsService, skip } from "@/settings/base";
import { ZoteroApiService } from "@/services/zotero-api/service";

export const enum DatabaseStatus {
  NotInitialized,
  Pending,
  Ready,
}

export default class Database extends Service {
  settings = this.use(SettingsService);
  app = this.use(App);
  server = this.use(Server);
  apiService = this.use(ZoteroApiService);

  private _plugin?: Plugin;
  public initializePlugin(plugin: Plugin) {
    this._plugin = plugin;
  }

  /** Expose the API service as the database API */
  get api() {
    return this.apiService;
  }

  /** Check if the Zotero API is reachable */
  connect(): Promise<boolean> {
    return this.apiService.connect();
  }

  @calc get citationLibrary(): number {
    return this.settings.current?.citationLibrary ?? 1;
  }

  onload() {
    log.debug("loading Database (HTTP API)");
    this.settings.once(async () => {
      try {
        await this.initialize();
      } catch (e) {
        log.error("Failed to initialize ZoteroDB via API", e);
        new Notice(
          "Failed to connect to Zotero. Please ensure Zotero is running and 'Allow other applications to communicate with Zotero' is enabled in Zotero's Advanced settings.",
        );
      }

      this.registerEvent(
        this.server.on("bg:notify", async (_, data) => {
          if (data.event !== "regular-item/update") return;
          await this.#handleItemUpdate(data);
        }),
      );

      this._plugin?.addCommand({
        id: "refresh-zotero-data",
        name: "Refresh Zotero data",
        callback: async () => {
          await this.refresh({ task: "full" });
        },
      });
      this._plugin?.addCommand({
        id: "refresh-zotero-search-index",
        name: "Refresh Zotero search index",
        callback: async () => {
          await this.refresh({ task: "searchIndex" });
        },
      });
    });

    this.register(
      effect(
        skip(
          async () => {
            if (this.#status === DatabaseStatus.NotInitialized) {
              await this.initialize();
            } else {
              await this.refresh({ task: "full" });
            }
          },
          () => this.settings.zoteroApiPort,
        ),
      ),
    );

    this.register(
      effect(
        skip(
          async () => {
            await this.refresh({ task: "searchIndex", force: true });
            new Notice("Zotero search index updated.");
          },
          () => this.settings.libId,
          true,
        ),
      ),
    );
  }

  async onunload(): Promise<void> {
    this.#status = DatabaseStatus.NotInitialized;
    this.#nextRefresh = null;
  }

  #status: DatabaseStatus = DatabaseStatus.NotInitialized;
  get status() {
    return this.#status;
  }

  #indexedLibrary: number | null = null;

  async #initIndex(force: boolean) {
    const libToIndex = this.settings.libId;
    if (!force && this.#indexedLibrary === libToIndex) return false;
    if (libToIndex === undefined) return false;
    await this.apiService.loadAllItems(libToIndex);
    await this.apiService.initIndex(libToIndex);
    this.#indexedLibrary = libToIndex ?? null;
    return true;
  }

  async initialize() {
    if (this.#status !== DatabaseStatus.NotInitialized) {
      throw new Error("Calling init on already initialized db, use refresh instead");
    }
    const reachable = await this.apiService.connect();
    if (!reachable) {
      throw new Error("Zotero local API not reachable at port " + this.settings.zoteroApiPort);
    }
    await this.#initIndex(true);
    this.app.vault.trigger("zotero:db-ready");
    log.info("ZoteroDB (HTTP API) initialization complete.");
    this.#status = DatabaseStatus.Ready;
  }

  /** Handle real-time item update notifications from Zotero */
  #handleItemUpdate = debounce(
    async (data: INotifyRegularItem) => {
      log.debug("Handling item update notification", data);
      const lib = this.settings.libId ?? 1;

      await Promise.all([
        ...data.add.map(([, , key]) => this.apiService.updateItem(key, lib)),
        ...data.modify.map(([, , key]) => this.apiService.updateItem(key, lib)),
        ...data.trash.map(([, , key]) => this.apiService.removeItem(key, lib)),
      ]);

      this.app.metadataCache.trigger("zotero:search-refresh");
      log.debug("Item update complete");
    },
    1000,
    true,
  );

  // #region Refresh
  #pendingRefresh: Promise<void> | null = null;
  #nextRefresh: RefreshTask | null = null;

  public refresh(param: RefreshTask): Promise<void> {
    if (this.#status === DatabaseStatus.NotInitialized) {
      return Promise.reject(new Error("Calling refresh on uninitialized database"));
    }
    if (this.#status === DatabaseStatus.Ready) {
      this.#status = DatabaseStatus.Pending;
      const pending = (async () => {
        if (param.task === "searchIndex") {
          await this.#refreshSearchIndex(param.force);
        } else if (param.task === "full") {
          await this.#fullRefresh();
        } else {
          assertNever(param);
        }
        this.#status = DatabaseStatus.Ready;
        const nextTask = this.#nextRefresh;
        if (nextTask) {
          this.#nextRefresh = null;
          await this.refresh(nextTask);
        }
      })();
      return (this.#pendingRefresh = pending);
    } else if (this.#status === DatabaseStatus.Pending) {
      if (!this.#pendingRefresh)
        return Promise.reject(new Error("Other task in pending state"));
      this.#nextRefresh = this.#mergeTask(param);
      return this.#pendingRefresh;
    } else {
      assertNever(this.#status);
    }
  }

  async #refreshSearchIndex(force = false) {
    if (await this.#initIndex(force)) {
      this.app.metadataCache.trigger("zotero:search-refresh");
    }
  }

  async #fullRefresh() {
    await this.#refreshSearchIndex(true);
    new Notice("ZoteroDB Refresh complete.");
  }

  #mergeTask(curr: RefreshTask): RefreshTask {
    if (!this.#nextRefresh) return curr;
    const prev = this.#nextRefresh;
    if (prev.task === "full") return prev;
    if (prev.task === curr.task) {
      if (prev.task === "searchIndex") {
        return { ...prev, force: prev.force || (curr as RefreshSearchIndexTask).force };
      }
      return prev;
    }
    return { task: "full" };
  }
  // #endregion
}

interface RefreshSearchIndexTask {
  task: "searchIndex";
  force?: boolean;
}
interface RefreshFullTask {
  task: "full";
}

type RefreshTask = RefreshSearchIndexTask | RefreshFullTask;
