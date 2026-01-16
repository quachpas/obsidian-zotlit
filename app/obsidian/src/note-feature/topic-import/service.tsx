import { ObsidianContext } from "@obzt/components";
import { Service } from "@ophidian/core";
import { getAllTags, TFile, App, Plugin } from "obsidian";

import type { CachedMetadata, TAbstractFile } from "obsidian";
import ReactDOM from "react-dom";
import { context } from "@/components/basic/context";
import { untilDbRefreshed } from "@/utils/once";
import { createNote } from "./create-note";
import { TopicImportStatus } from "./status";
import { createStore, selectDisabled, topicPrefix } from "./utils";
import { Server } from "@/services/server/service";

export class TopicImport extends Service {
  app = this.use(App);
  server = this.use(Server);

  private _plugin?: Plugin;
  public initializePlugin(plugin: Plugin) {
    this._plugin = plugin;
  }

  store = createStore();

  file: TFile | null = null;
  get watching() {
    return this.store.getState().watching;
  }
  get topic(): string | undefined {
    const state = this.store.getState();
    if (!state.watching) return undefined;
    return state.topics[state.activeTopic];
  }
  onFileOpen(file: TAbstractFile | null, force = false) {
    if (this.watching) return;
    if (!(file instanceof TFile)) {
      this.file = null;
      this.store.getState().emptyTopics();
      return;
    }
    this.file = file;
    const meta = this.app.metadataCache.getFileCache(file);
    if (!meta) {
      this.store.getState().emptyTopics();
      return;
    }
    this.onMetaUpdate(file, meta, force);
  }
  onMetaUpdate(file: TFile, cache: CachedMetadata, force: boolean) {
    // skip if not active file
    if (
      !force &&
      ((this.file && file.path !== this.file.path) || this.watching)
    ) {
      return;
    }
    const tags =
      getAllTags(cache)?.filter((t) => t.startsWith(topicPrefix)) ?? [];
    this.store.getState().setTopics(tags);
  }

  registerTopic(callback: (topic: string | null) => void) {
    return this.store.subscribe((state, prev) => {
      if (state.watching === prev.watching) return;
      if (state.watching) {
        callback(state.topics[state.activeTopic]);
      } else {
        callback(null);
      }
    });
  }

  onload(): void {
    const plugin = this._plugin;
    if (!plugin) throw new Error("Plugin not initialized");

    this.registerEvent(
      this.server.on("bg:notify", async (_p, data) => {
        if (
          data.event !== "regular-item/update" ||
          !this.topic ||
          !data.add.length
        )
          return;

        const [task, cancel] = untilDbRefreshed(this.app, {
          waitAfterEvent: 1e3,
        });
        cancel && this.register(cancel);
        await task;
        await createNote(data.add, {
          currTopic: this.topic,
          plugin: plugin as any, // TODO: Fix plugin type
        });
      }),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) =>
        this.onFileOpen(file),
      ),
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", (file, _d, cache) =>
        this.onMetaUpdate(file, cache, false),
      ),
    );
    this.onFileOpen(this.app.workspace.getActiveFile(), true);
    this.register(
      this.store.subscribe((state, prev) => {
        if (state.watching === prev.watching) return;
        this.onFileOpen(this.app.workspace.getActiveFile(), true);
      }),
    );
    const statusBarItem = plugin.addStatusBarItem();
    statusBarItem.addClass("obzt");
    ReactDOM.render(
      <ObsidianContext.Provider value={context}>
        <TopicImportStatus store={this.store} />
      </ObsidianContext.Provider>,
      statusBarItem,
    );
    statusBarItem.toggleClass(
      "mod-clickable",
      !selectDisabled(this.store.getState()),
    );
    this.register(
      this.store.subscribe((state, prev) => {
        if (!state.topics === !prev.topics) return;
        statusBarItem.toggleClass("mod-clickable", !selectDisabled(state));
      }),
    );
    this.register(() => ReactDOM.unmountComponentAtNode(statusBarItem));
  }
}
