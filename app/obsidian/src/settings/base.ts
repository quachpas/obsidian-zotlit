import { join } from "path";
import type { DatabaseOptions, DatabasePaths } from "@obzt/database/api";
import type { Useful } from "@ophidian/core";
import {
  calc,
  SettingsService as _SettingsService,
  getContext,
} from "@ophidian/core";
import { Plugin, type Component } from "obsidian";
import { getBinaryFullPath } from "@/install-guide/version";
import { getDefaultSettings, type Settings } from "./service";

export function skip<T extends (...args: any[]) => any>(
  compute: T,
  deps: () => any,
  skipInitial = false,
) {
  let count = 0;
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    deps();
    if (count++ > (skipInitial ? 1 : 0)) {
      return compute(...args);
    }
  };
}

export class SettingsService extends _SettingsService<Settings> {
  #plugin?: Plugin;

  initialize(plugin: Plugin) {
    this.#plugin = plugin;
  }

  /** cache result */
  #nativeBinding?: string;
  get nativeBinding(): string {
    if (this.#nativeBinding) return this.#nativeBinding;
    if (!this.#plugin) throw new Error("SettingsService not initialized");
    const binaryFullPath = getBinaryFullPath(this.#plugin.manifest);
    if (binaryFullPath) {
      this.#nativeBinding = binaryFullPath;
      return this.#nativeBinding;
    } else throw new Error("Failed to get native binding path");
  }

  @calc get templateDir() {
    return this.current?.template?.folder;
  }

  @calc get libId() {
    return this.current?.citationLibrary;
  }

  @calc get simpleTemplates() {
    return this.current?.template?.templates;
  }

  @calc get zoteroDbPath(): string {
    return join(this.current?.zoteroDataDir ?? "", "zotero.sqlite");
  }

  @calc get bbtSearchDbPath(): string {
    return join(this.current?.zoteroDataDir ?? "", "better-bibtex-search.sqlite");
  }

  @calc get bbtMainDbPath(): string {
    return join(this.current?.zoteroDataDir ?? "", "better-bibtex.sqlite");
  }

  @calc get zoteroCacheDirPath(): string {
    return join(this.current?.zoteroDataDir ?? "", "cache");
  }

  @calc get mirrorDir(): string {
    if (!this.#plugin) return "";
    // @ts-ignore
    const vaultPath = this.#plugin.app.vault.adapter.getBasePath();
    return join(vaultPath, this.#plugin.manifest.dir ?? "", "zotero-db-mirror");
  }

  @calc get zoteroDbMirrorPath(): string {
    return join(this.mirrorDir, "zotero.sqlite");
  }

  @calc get bbtSearchDbMirrorPath(): string {
    return join(this.mirrorDir, "better-bibtex-search.sqlite");
  }

  @calc get bbtMainDbMirrorPath(): string {
    return join(this.mirrorDir, "better-bibtex.sqlite");
  }

  @calc get dbConnParams(): [paths: DatabasePaths, opts: DatabaseOptions] {
    return [
      {
        zotero: this.zoteroDbMirrorPath,
        bbtSearch: this.bbtSearchDbMirrorPath,
        bbtMain: this.bbtMainDbMirrorPath,
      },
      { nativeBinding: this.nativeBinding },
    ];
  }
}

export function useSettings(owner: Component & Partial<Useful>) {
  const svc = getContext(owner)(SettingsService) as SettingsService;
  if (owner instanceof Plugin) {
    svc.initialize(owner);
  }
  svc.addDefaults(getDefaultSettings());
  return svc;
}
