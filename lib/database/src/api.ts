import type {
  DocumentSearchOptions,
  SimpleDocumentSearchResultSetUnit,
} from "flexsearch";
import type { AnnotationInfo, NoteInfo, RegularItemInfo } from "./item.js";
import type { KeyLibID } from "./utils/database.js";
import type { LibraryInfo, AttachmentInfo, TagInfo } from "./index.js";

export type QueryOption = DocumentSearchOptions<false>;
export type { SimpleDocumentSearchResultSetUnit } from "flexsearch";

export interface DbWorkerAPI {
  search(
    libraryID: number,
    options: Partial<DocumentSearchOptions<false>>,
  ): Promise<SimpleDocumentSearchResultSetUnit[]>;

  getItems(
    items: KeyLibID[],
    forceUpdate?: boolean,
  ): Promise<(RegularItemInfo | null)[]>;

  getItemsFromCache(limit: number, lib: number): Promise<RegularItemInfo[]>;

  getLibs(): LibraryInfo[];
  getAnnotations(attachmentKey: string, libraryID: number): Promise<AnnotationInfo[]>;
  getAttachments(docKey: string, libraryID: number): Promise<AttachmentInfo[]>;
  getTags(items: KeyLibID[]): Record<string, TagInfo[]>;

  getItemKeyFromCitekey(
    citekeys: string[],
    libraryID: number,
  ): Record<string, string>;
  getAnnotFromKey(
    keys: string[],
    libraryID: number,
  ): Promise<Record<string, AnnotationInfo>>;

  getNotes(itemKey: string, libraryID: number): Promise<NoteInfo[]>;
  getNoteFromKey(
    keys: string[],
    libraryID: number,
  ): Promise<Record<string, NoteInfo>>;
}
