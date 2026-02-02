import { promises as fs, watch, type FSWatcher, existsSync } from "fs";
import { dirname, basename } from "path";
import { Service, calc, effect } from "@ophidian/core";
import { App, debounce } from "obsidian";
import log from "@/log";
import { SettingsService, skip } from "@/settings/base";

export default class DatabaseWatcher extends Service {
  settings = this.use(SettingsService);
  app = this.use(App);

  @calc
  get autoRefresh() {
    return this.settings.current?.autoRefresh;
  }

  onDatabaseUpdate(target: "main" | "bbt") {
    return () => this.app.vault.trigger("zotero:db-updated", target);
  }

  onload() {
    this.register(
      effect(
        skip(
          () => this.setAutoRefresh(this.autoRefresh),
          () => {
            this.autoRefresh;
            this.settings.zoteroDbPath;
            this.settings.bbtMainDbPath;
            this.settings.bbtSearchDbPath;
          },
        ),
      ),
    );
    log.debug("loading DatabaseWatcher");
  }

  onunload(): void {
    this.#unloadWatchers();
  }

  #unloadWatchers() {
    this.#enabled = false;
    Object.values(this.#watcher).forEach((w) => w?.close());
    this.#watcher = { main: null, bbt: null };
  }

  #watcher: Record<"main" | "bbt", FSWatcher | null> = {
    main: null,
    bbt: null,
  };
  #enabled = false;

  async setAutoRefresh(enable: boolean, force = false) {
    if (!enable && !this.#enabled && !force) return;
    log.debug("Auto refresh set to " + enable);
    this.#enabled = enable;
    this.#unloadWatchers();
    if (enable) {
      this.#watchFile(
        "main",
        this.settings.zoteroDbPath,
        this.settings.zoteroDbMirrorPath,
      );

      // Check for BBT files existence before watching
      if (existsSync(this.settings.bbtMainDbPath)) {
        this.#watchFile(
          "bbt",
          this.settings.bbtMainDbPath,
          this.settings.bbtMainDbMirrorPath,
        );
      } else if (existsSync(this.settings.bbtSearchDbPath)) {
        this.#watchFile(
          "bbt",
          this.settings.bbtSearchDbPath,
          this.settings.bbtSearchDbMirrorPath,
        );
      }
    }
  }

  #watchFile(target: "main" | "bbt", src: string, dest: string) {
    try {
      if (!existsSync(src)) {
        log.warn(`Cannot watch ${target}: ${src} does not exist.`);
        return;
      }

      const copyAndUpdate = debounce(
        async () => {
          try {
            await this.#copyFile(src, dest);
            this.onDatabaseUpdate(target)();
          } catch (e) {
            log.error(`Failed to copy ${target} db from ${src} to ${dest}`, e);
          }
        },
        2000,
        true,
      );

      const dir = dirname(src);
      const name = basename(src);
      this.#watcher[target] = watch(dir, (event, filename) => {
        if (filename === name) {
          copyAndUpdate();
        }
      });
      log.debug(`Started watching ${target} at ${src}`);
    } catch (e) {
      log.error(`Failed to start watcher for ${target}`, e);
    }
  }

  async #copyFile(src: string, dest: string) {
    try {
      await fs.mkdir(dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
      log.debug(`Copied ${src} to ${dest}`);
    } catch (e) {
      log.error(`Failed to copy file ${src} to ${dest}`, e);
      throw e;
    }
  }

  /**
   * Prepares the mirror by copying files if needed.
   * Call this before connecting to the database.
   */
  async prepare() {
    log.debug("Preparing Zotero DB mirror...");
    const p: Promise<void>[] = [];

    // Always try to copy main DB
    if (existsSync(this.settings.zoteroDbPath)) {
      p.push(
        this.#copyFile(
          this.settings.zoteroDbPath,
          this.settings.zoteroDbMirrorPath,
        ),
      );
    } else {
      log.warn(`Zotero DB not found at ${this.settings.zoteroDbPath}`);
    }

    // Try to copy BBT DBs
    if (existsSync(this.settings.bbtMainDbPath)) {
      p.push(
        this.#copyFile(
          this.settings.bbtMainDbPath,
          this.settings.bbtMainDbMirrorPath,
        ),
      );
    }
    if (existsSync(this.settings.bbtSearchDbPath)) {
      p.push(
        this.#copyFile(
          this.settings.bbtSearchDbPath,
          this.settings.bbtSearchDbMirrorPath,
        ),
      );
    }

    await Promise.allSettled(p);
    log.debug("Zotero DB mirror prepared.");
  }
}
