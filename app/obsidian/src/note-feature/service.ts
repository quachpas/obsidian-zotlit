import { join } from "path/posix";
import type { ItemKeyGroup } from "@obzt/common";
import type { RegularItemInfoBase } from "@obzt/database";
import { Service } from "@ophidian/core";

import { TFile, Notice, Plugin, App } from "obsidian";
import {
  cacheAttachmentSelect,
  chooseAnnotAtch,
} from "@/components/atch-suggest";
import { getItemKeyOf, isLiteratureNote } from "@/services/note-index";
import { Template as TemplateRenderer } from "@/services/template/render";
import { Template, fromPath } from "@/services/template/eta/preset";
import type { Context } from "@/services/template/helper/base.js";
import { AnnotationView, annotViewType } from "./annot-view/view";
import { CitationEditorSuggest, insertCitationTo } from "./citation-suggest/";
import { importNote } from "./note-import";
import { openOrCreateNote } from "./quick-switch";
import {
  ItemDetailsView,
  itemDetailsViewType,
} from "./template-preview/details";
import { openTemplatePreview } from "./template-preview/open";
import {
  TemplatePreview,
  templatePreviewViewType,
} from "./template-preview/preview";
import { getHelperExtraByAtch, updateNote } from "./update-note";
import NoteIndex from "@/services/note-index/service";
import DatabaseWorker from "@/services/zotero-db/connector/service";
import { SettingsService } from "@/settings/base";
import { NoteParser } from "@/services/note-parser/service";

class NoteFeatures extends Service {
  settings = this.use(SettingsService);
  noteIndex = this.use(NoteIndex);
  dbWorker = this.use(DatabaseWorker);
  templateRenderer = this.use(TemplateRenderer);
  noteParser = this.use(NoteParser);
  app = this.use(App);

  private _plugin?: Plugin;
  public initializePlugin(plugin: Plugin) {
    this._plugin = plugin;
  }

  // noteFields = this.use(NoteFields);
  // topicImport = this.use(TopicImport);

  onload(): void {
    const plugin = this._plugin!;
    const { app } = plugin;
    plugin.addCommand({
      id: "note-quick-switcher",
      name: "Open quick switcher for literature notes",
      callback: () => openOrCreateNote(plugin as any), // TODO: Fix plugin type in openOrCreateNote
    });
    plugin.registerView(
      annotViewType,
      (leaf) => new AnnotationView(leaf, plugin as any), // TODO: Fix plugin type in AnnotationView
    );
    plugin.registerView(
      templatePreviewViewType,
      (leaf) => new TemplatePreview(leaf, plugin as any), // TODO: Fix plugin type in TemplatePreview
    );
    plugin.registerView(
      itemDetailsViewType,
      (leaf) => new ItemDetailsView(leaf, plugin as any), // TODO: Fix plugin type in ItemDetailsView
    );
    plugin.registerEvent(
      plugin.app.workspace.on("file-menu", (menu, file) => {
        const tpl = fromPath(file.path, this.settings.templateDir ?? "");
        if (tpl?.type !== "ejectable") return;
        menu.addItem((i) =>
          i
            .setIcon("edit")
            .setTitle("Open template preview")
            .onClick(() => {
              openTemplatePreview(tpl.name, null, plugin as any); // TODO: Fix plugin type in openTemplatePreview
            }),
        );
      }),
    );
    // plugin.registerView(
    //   noteFieldsViewType,
    //   (leaf) => new NoteFieldsView(leaf, plugin),
    // );
    plugin.addCommand({
      id: "zotero-annot-view",
      name: "Open Zotero annotation view in side panel",
      callback: () => {
        app.workspace.ensureSideLeaf(annotViewType, "right", {
          active: true,
          /**
           * Workaroud to make sure view shows active file when first open
           * TODO: bug report? replicate in Backlink, Outline etc...
           */
          state: { file: app.workspace.getActiveFile()?.path },
        });
      },
    });
    // plugin.addCommand({
    //   id: "zotero-note-fields",
    //   name: "Open Literature Note Fields in Side Panel",
    //   callback: () => {
    //     app.workspace.ensureSideLeaf(noteFieldsViewType, "right", {
    //       active: true,
    //       /**
    //        * Workaroud to make sure view shows active file when first open
    //        * TODO: bug report? replicate in Backlink, Outline etc...
    //        */
    //       state: { file: app.workspace.getActiveFile()?.path },
    //     });
    //   },
    // });
    plugin.addCommand({
      id: "insert-markdown-citation",
      name: "Insert Markdown citation",
      editorCallback: (editor, ctx) =>
        insertCitationTo(editor, ctx.file, plugin as any), // TODO: Fix plugin type
    });
    plugin.registerEditorSuggest(new CitationEditorSuggest(plugin as any)); // TODO: Fix plugin type

    const updateNote = async (file: TFile, overwrite?: boolean) => {
      const lib = this.settings.libId;
      const itemKey = getItemKeyOf(file, app.metadataCache);
      if (!itemKey) {
        new Notice("Cannot get zotero item key from file name");
        return false;
      }
      const [item] = await this.dbWorker.api.getItems([[itemKey, lib]]);
      if (!item) {
        new Notice("Cannot find zotero item with key " + itemKey);
        return false;
      }
      await this.updateNote(item, overwrite);
    };
    plugin.addCommand({
      id: "update-literature-note",
      name: "Update literature note",
      editorCheckCallback(checking, _editor, ctx) {
        const shouldContinue = ctx.file && isLiteratureNote(ctx.file, app);
        if (checking) {
          return !!shouldContinue;
        } else if (shouldContinue) {
          updateNote(ctx.file);
        }
      },
    });
    plugin.addCommand({
      id: "overwrite-update-literature-note",
      name: "Force update literature note by overwriting",
      editorCheckCallback(checking, _editor, ctx) {
        const shouldContinue = ctx.file && isLiteratureNote(ctx.file, app);
        if (checking) {
          return !!shouldContinue;
        } else if (shouldContinue) {
          updateNote(ctx.file, true);
        }
      },
    });
    plugin.addCommand({
      id: "import-note",
      name: "Import note",
      callback: () => importNote(plugin as any), // TODO: Fix plugin type
    });
    plugin.registerEvent(
      plugin.app.workspace.on("file-menu", (menu, file) => {
        if (!isLiteratureNote(file, app)) {
          return;
        }
        menu.addItem((i) =>
          i
            .setTitle("Update literature note")
            .setIcon("sync")
            .onClick(() => updateNote(file)),
        );
        if (!this.settings.current?.updateOverwrite)
          menu.addItem((i) =>
            i
              .setTitle("Force update by overwriting")
              .setIcon("sync")
              .onClick(() => updateNote(file, true)),
          );
      }),
    );
    plugin.registerEvent(
      plugin.app.workspace.on("file-menu", (menu, file) => {
        const tpl = fromPath(file.path, this.settings.templateDir ?? "");
        if (tpl?.type !== "ejectable") return;
        menu.addItem((i) =>
          i
            .setTitle("Reset to default")
            .setIcon("reset")
            .onClick(async () => {
              // make sure prompt is shown in the active window
              if (!activeWindow.confirm("Reset template to default?")) return;
              await plugin.app.vault.modify(
                file as TFile,
                Template.Ejectable[tpl.name],
              );
            }),
        );
      }),
    );
  }
  async openNote(item: ItemKeyGroup, slience = false): Promise<boolean> {
    const { workspace } = this.app;
    const { noteIndex } = this;

    const info = noteIndex.getNotesFor(item);
    if (!info.length) {
      !slience &&
        new Notice(
          `No literature note found for zotero item with key ${item.key}`,
        );
      return false;
    }

    // TODO: support multiple notes
    const firstNote = info.sort().shift()!;
    await workspace.openLinkText(firstNote, "", false, { active: true });
    return true;
  }

  async createNoteForDocItem(
    docItem: RegularItemInfoBase,
    render: {
      note: (template: TemplateRenderer, ctx: Context) => string;
      filename: (template: TemplateRenderer, ctx: Context) => string;
    },
  ) {
    const { noteIndex } = this;

    const info = noteIndex.getNotesFor(docItem);
    if (info.length) {
      // only throw error if the note is linked to the same zotero item
      throw new NoteExistsError(info, docItem.key);
    }

    const { vault, fileManager } = this.app,
      { literatureNoteFolder: folder } = this.settings.current ?? { literatureNoteFolder: "" },
      template = this.templateRenderer;

    const filepath = join(
      folder,
      render.filename(template, { plugin: this._plugin as any }), // TODO: Fix plugin type
    );
    const existingFile = vault.getAbstractFileByPath(filepath);
    if (existingFile) {
      if (getItemKeyOf(existingFile, this.app.metadataCache)) {
        // only throw error if the note is linked to the same zotero item
        throw new NoteExistsError([filepath], docItem.key);
      }
    }

    // filepath with suffix if file already exists
    const note = await fileManager.createNewMarkdownFile(
      vault.getRoot(),
      filepath,
      render.note(template, {
        plugin: this._plugin as any, // TODO: Fix plugin type
        sourcePath: filepath,
      }),
    );
    return note;
  }

  async createNoteForDocItemFull(item: RegularItemInfoBase): Promise<string> {
    const libId = this.settings.libId ?? 1;
    const allAttachments = await this.dbWorker.api.getAttachments(
      item.itemID,
      libId,
    );
    const selected = await chooseAnnotAtch(allAttachments, this.app);
    if (selected) {
      cacheAttachmentSelect(selected, item);
    }
    const notes = await this.dbWorker.api
      .getNotes(item.itemID, libId ?? 1)
      .then((notes) => this.noteParser.normalizeNotes(notes));

    const extraByAtch = await getHelperExtraByAtch(
      item,
      { all: allAttachments, selected: selected ? [selected] : [], notes },
      this._plugin as any, // TODO: Fix plugin type
    );
    const extra = Object.values(extraByAtch)[0];
    const note = await this.createNoteForDocItem(item, {
      note: (template, ctx) => template.renderNote(extra, ctx),
      filename: (template, ctx) => template.renderFilename(extra, ctx),
    });
    return note.path;
  }

  async updateNoteFromId(id: ItemKeyGroup & { libraryID: number }) {
    const { noteIndex, dbWorker: databaseAPI } = this;

    const info = noteIndex.getNotesFor(id);
    if (!info.length) {
      new Notice(`No literature note found for zotero item with key ${id.key}`);
      return;
    }
    const [item] = await databaseAPI.api.getItems([[id.key, id.libraryID]]);
    if (!item) {
      new Notice(`Cannot find zotero item with key ${id.key}`);
      return;
    }
    await this.updateNote(item);
  }

  async updateNote(item: RegularItemInfoBase, overwrite?: boolean) {
    const summary = await updateNote(item, this._plugin as any, overwrite); // TODO: Fix plugin type
    if (summary) {
      if (summary.addedAnnots > 0 || summary.updatedAnnots > 0)
        new Notice(
          `Affected ${summary.notes} notes, ` +
            `annotations: ${summary.addedAnnots} added, ` +
            `${summary.updatedAnnots} updated`,
        );
      else new Notice(`Affected ${summary.notes} notes, no annotation updated`);
    } else {
      new Notice("No note found for this literature");
    }
  }
}

export default NoteFeatures;

export class NoteExistsError extends Error {
  constructor(public targets: string[], public key: string) {
    super(`Note linked to ${key} already exists: ${targets.join(",")}`);
    this.name = "NoteExistsError";
  }
}
