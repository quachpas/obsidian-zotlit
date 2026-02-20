import type { KeyLibID } from "@obzt/database";
import { Notice } from "obsidian";
import log from "@/log";
import type ZoteroPlugin from "@/zt-main";
import type { TemplateRenderer } from "@/services/template";
import type { Context } from "@/services/template/helper";

export async function createNote(
  ids: KeyLibID[],
  { currTopic, plugin }: { currTopic: string; plugin: ZoteroPlugin },
) {
  const items = (await plugin.databaseAPI.getItems(ids, true)).flatMap(
    (item, index) => {
      if (item === null) {
        log.warn("item not found", ids[index]);
        return [];
      }
      return [[item, index] as const];
    },
  );
  const tags = await plugin.databaseAPI.getTags(ids);

  for (const [item, index] of items) {
    const [key, libId] = ids[index];
    const attachments = await plugin.databaseAPI.getAttachments(key, libId);
    const extra = {
      docItem: item,
      tags,
      attachment: null,
      allAttachments: attachments,
      annotations: [],
      notes: await plugin.databaseAPI
        .getNotes(item.key, item.libraryID)
        .then((notes) => plugin.noteParser.normalizeNotes(notes)),
    };
    await plugin.noteFeatures.createNoteForDocItem(item, {
      note: (template: TemplateRenderer, ctx: Context) =>
        template.renderNote(extra, ctx, { tags: [currTopic] }),
      filename: (template: TemplateRenderer, ctx: Context) => template.renderFilename(extra, ctx),
    });
    new Notice(`Created note for ${item.title}`, 1e3);
  }
}
