import type { Useful } from "@ophidian/core";
import {
  calc,
  SettingsService as _SettingsService,
  getContext,
} from "@ophidian/core";
import { Plugin, type Component } from "obsidian";
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

  @calc get templateDir() {
    return this.current?.template?.folder;
  }

  @calc get libId() {
    return this.current?.citationLibrary;
  }

  @calc get simpleTemplates() {
    return this.current?.template?.templates;
  }

  @calc get zoteroApiKey(): string {
    return this.current?.zoteroApiKey ?? "";
  }

  @calc get zoteroCacheDirPath(): string {
    return this.current?.zoteroCacheDir ?? "";
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
