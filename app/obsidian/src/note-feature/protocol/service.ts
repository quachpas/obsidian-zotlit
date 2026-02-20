import type { AnnotationsQuery, ItemsQuery } from "@obzt/protocol";
import { parseQuery } from "@obzt/protocol";
import { Service } from "@ophidian/core";
import { App, Notice, Plugin } from "obsidian";
import { Server } from "@/services/server/service";
import NoteFeatures from "@/note-feature/service";
import DatabaseWorker from "@/services/zotero-db/connector/service";

export class ProtocolHandler extends Service {
  server = this.use(Server);
  dbWorker = this.use(DatabaseWorker);
  app = this.use(App);

  private _plugin?: Plugin;
  public initializePlugin(plugin: Plugin) {
    this._plugin = plugin;
  }

  onload(): void {
    this.registerEvent(
      this.server.on("zotero/open", (p) => this.onZtOpen(parseQuery(p))),
    );
    this.registerEvent(
      this.server.on("zotero/export", (p) =>
        this.onZtExport(parseQuery(p)),
      ),
    );
    this.registerEvent(
      this.server.on("zotero/update", (p) =>
        this.onZtExport(parseQuery(p)),
      ),
    );
  }
  
  get noteFeatures() {
    return this.use(NoteFeatures);
  }

  async onZtOpen(query: AnnotationsQuery | ItemsQuery) {
    if (query.type === "annotation") {
      new Notice("Not implemented yet");
      return;
    }
    if (query.items.length < 1) {
      new Notice("No items to open");
      return;
    }
    await this.noteFeatures.openNote(query.items[0]);
  }
  async onZtUpdate(query: AnnotationsQuery | ItemsQuery) {
    if (query.type === "annotation") {
      new Notice("Single annotation update not yet supported");
      return;
    }
    if (query.items.length < 1) {
      new Notice("No items to open");
      return;
    }
    if (query.items.length > 1) {
      new Notice("Multiple literature note update not yet supported");
      return;
    }
    await this.noteFeatures.updateNoteFromId(query.items[0]);
  }
  async onZtExport(query: AnnotationsQuery | ItemsQuery) {
    if (query.type === "annotation") {
      new Notice("Not implemented yet");
      return;
    }
    if (query.items.length < 1) {
      new Notice("No items to open");
    } else if (query.items.length > 1) {
      new Notice("Multiple items not yet supported");
    }
    const { libraryID, key } = query.items[0];
    const [docItem] = await this.dbWorker.api.getItems([[key, libraryID]]);
    if (!docItem) {
      new Notice("Item not found: " + key);
      return;
    }
    const notePath = await this.noteFeatures.createNoteForDocItemFull(
      docItem,
    );
    await this.app.workspace.openLinkText(notePath, "", false, {
      active: true,
    });
  }
}
