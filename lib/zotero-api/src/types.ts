/** Zotero local HTTP API response types */

export interface ZoteroApiCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface ZoteroApiTag {
  tag: string;
  type?: number;
}

export interface ZoteroApiLibrary {
  type: "user" | "group";
  id: number;
  name: string;
  links: {
    alternate: { href: string; type: string };
  };
}

/** Data fields for a regular Zotero item */
export interface ZoteroApiItemData {
  key: string;
  version: number;
  itemType: string;
  title?: string;
  creators?: ZoteroApiCreator[];
  abstractNote?: string;
  date?: string;
  dateAdded?: string;
  dateModified?: string;
  citationKey?: string;
  collections?: string[];
  tags?: ZoteroApiTag[];
  relations?: Record<string, string | string[]>;
  [key: string]: unknown;
}

/** Data fields for an annotation item */
export interface ZoteroApiAnnotationData {
  key: string;
  version: number;
  itemType: "annotation";
  parentItem: string;
  annotationType: "highlight" | "note" | "image" | "ink" | "underline" | "freetext";
  annotationText?: string;
  annotationComment?: string;
  annotationColor?: string;
  annotationPageLabel?: string;
  annotationSortIndex?: string;
  annotationPosition?: string;
  dateAdded?: string;
  dateModified?: string;
  tags?: ZoteroApiTag[];
}

/** Data fields for a note item */
export interface ZoteroApiNoteData {
  key: string;
  version: number;
  itemType: "note";
  parentItem?: string;
  note: string;
  title?: string;
  tags?: ZoteroApiTag[];
  dateAdded?: string;
  dateModified?: string;
}

/** Data fields for an attachment item */
export interface ZoteroApiAttachmentData {
  key: string;
  version: number;
  itemType: "attachment";
  parentItem?: string;
  title?: string;
  linkMode: "imported_file" | "imported_url" | "linked_file" | "linked_url";
  contentType?: string;
  path?: string;
  url?: string;
  filename?: string;
  dateAdded?: string;
  dateModified?: string;
  tags?: ZoteroApiTag[];
}

export interface ZoteroApiItemMeta {
  numChildren?: number;
  creatorSummary?: string;
  parsedDate?: string;
}

/** Generic API item wrapper */
export interface ZoteroApiItem<T = ZoteroApiItemData> {
  key: string;
  version: number;
  library: ZoteroApiLibrary;
  links: unknown;
  meta: ZoteroApiItemMeta;
  data: T;
}

export interface ZoteroApiCollection {
  key: string;
  version: number;
  library: ZoteroApiLibrary;
  data: {
    key: string;
    version: number;
    name: string;
    parentCollection: string | false;
  };
}

export type ZoteroApiRegularItem = ZoteroApiItem<ZoteroApiItemData>;
export type ZoteroApiAnnotationItem = ZoteroApiItem<ZoteroApiAnnotationData>;
export type ZoteroApiNoteItem = ZoteroApiItem<ZoteroApiNoteData>;
export type ZoteroApiAttachmentItem = ZoteroApiItem<ZoteroApiAttachmentData>;
export type ZoteroApiChildItem =
  | ZoteroApiAnnotationItem
  | ZoteroApiNoteItem
  | ZoteroApiAttachmentItem;

export function isAnnotationData(
  data: ZoteroApiAnnotationData | ZoteroApiNoteData | ZoteroApiAttachmentData,
): data is ZoteroApiAnnotationData {
  return data.itemType === "annotation";
}
export function isNoteData(
  data: ZoteroApiAnnotationData | ZoteroApiNoteData | ZoteroApiAttachmentData,
): data is ZoteroApiNoteData {
  return data.itemType === "note";
}
export function isAttachmentData(
  data: ZoteroApiAnnotationData | ZoteroApiNoteData | ZoteroApiAttachmentData,
): data is ZoteroApiAttachmentData {
  return data.itemType === "attachment";
}
