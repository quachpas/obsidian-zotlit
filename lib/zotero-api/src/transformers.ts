import type {
  AnnotationInfo,
  AttachmentInfo,
  Collection,
  Creator,
  LibraryInfo,
  NoteInfo,
  RegularItemInfo,
  RegularItemInfoBase,
} from "@obzt/database";
import { AttachmentType, CreatorFieldMode } from "@obzt/zotero-type";
import type {
  ZoteroApiAnnotationItem,
  ZoteroApiAttachmentItem,
  ZoteroApiCollection,
  ZoteroApiCreator,
  ZoteroApiNoteItem,
  ZoteroApiRegularItem,
} from "./types.js";

// re-export for convenience
export type { LibraryInfo };

function creatorFromApi(c: ZoteroApiCreator): Creator {
  if (c.name) {
    return {
      firstName: null,
      lastName: c.name,
      fieldMode: CreatorFieldMode.nameOnly,
    };
  }
  return {
    firstName: c.firstName ?? null,
    lastName: c.lastName ?? null,
    fieldMode: CreatorFieldMode.fullName,
  };
}

/** Convert API item to RegularItemInfo. itemID is set to 0 (not available via HTTP API). */
export function apiItemToRegularItemInfo(
  apiItem: ZoteroApiRegularItem,
  collectionsMap: Map<string, Collection>,
): RegularItemInfo {
  const { data, library } = apiItem;
  const groupID = library.type === "group" ? library.id : null;
  const libraryID = library.type === "user" ? library.id : library.id;

  const creators = (data.creators ?? []).map((c, i) => ({
    orderIndex: i,
    creatorType: c.creatorType,
    ...creatorFromApi(c),
  }));

  const collections = (data.collections ?? [])
    .map((key) => collectionsMap.get(key))
    .filter((c): c is Collection => c !== undefined);

  // dateAccessed is in dateAdded / data.accessDate if present
  const dateAccessed = data.accessDate
    ? new Date(data.accessDate as string)
    : data.dateAdded
      ? new Date(data.dateAdded)
      : null;

  const base: RegularItemInfoBase = {
    itemID: 0,
    libraryID,
    key: data.key,
    groupID,
    itemType: data.itemType,
    creators,
    citekey: data.citationKey ?? null,
    collections,
    dateAccessed,
  };

  // Copy remaining data fields as array-wrapped values (to match RegularItemInfo shape)
  const extra: Record<string, unknown[]> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k in base || k === "creators" || k === "collections") continue;
    extra[k] = Array.isArray(v) ? v : [v];
  }

  return Object.assign(base, extra) as unknown as RegularItemInfo;
}

export function apiCollectionToCollection(
  apiCol: ZoteroApiCollection,
  allCollections: ZoteroApiCollection[],
): Collection {
  const { data, library } = apiCol;
  const path = buildPath(data.key, allCollections);
  return {
    id: 0,
    key: data.key,
    name: data.name,
    path,
    libraryID: library.id,
  };
}

function buildPath(key: string, all: ZoteroApiCollection[]): string[] {
  const col = all.find((c) => c.data.key === key);
  if (!col) return [key];
  if (!col.data.parentCollection) return [col.data.name];
  return [...buildPath(col.data.parentCollection, all), col.data.name];
}

const LINK_MODE_MAP: Record<string, AttachmentType> = {
  imported_file: AttachmentType.importedFile,
  imported_url: AttachmentType.importedUrl,
  linked_file: AttachmentType.linkedFile,
  linked_url: AttachmentType.linkedUrl,
};

export function apiAttachmentToAttachmentInfo(
  apiItem: ZoteroApiAttachmentItem,
  annotCount = 0,
): AttachmentInfo {
  const { data } = apiItem;
  return {
    itemID: 0,
    key: data.key,
    path: data.path ?? data.filename ?? null,
    contentType: data.contentType ?? null,
    linkMode: LINK_MODE_MAP[data.linkMode] ?? null,
    charsets: null,
    annotCount,
  } as unknown as AttachmentInfo;
}

const API_ANNOTATION_TYPE_MAP: Record<string, number> = {
  highlight: 1,
  note: 2,
  image: 3,
  underline: 4,
  ink: 5,
};

export function apiAnnotationToAnnotationInfo(
  apiItem: ZoteroApiAnnotationItem,
  parentItemKey: string,
): AnnotationInfo {
  const { data, library } = apiItem;
  const sortIndexRaw = data.annotationSortIndex ?? "00000|000000|00000";
  const sortIndex = sortIndexRaw.split("|").map((s) => parseInt(s, 10));

  let position: AnnotationInfo["position"];
  try {
    position = JSON.parse(data.annotationPosition ?? "{}");
  } catch {
    position = {} as AnnotationInfo["position"];
  }

  return {
    itemID: 0,
    libraryID: library.id,
    key: data.key,
    groupID: library.type === "group" ? library.id : null,
    itemType: "annotation",
    parentItem: data.parentItem,
    parentItemID: 0,
    // Map API string type to numeric AnnotationType enum
    type: API_ANNOTATION_TYPE_MAP[data.annotationType] ?? 1,
    text: data.annotationText ?? null,
    comment: data.annotationComment ?? null,
    color: data.annotationColor ?? null,
    pageLabel: data.annotationPageLabel ?? null,
    authorName: null,
    isExternal: 0,
    sortIndex,
    position,
  } as unknown as AnnotationInfo;
}

export function apiNoteToNoteInfo(apiItem: ZoteroApiNoteItem): NoteInfo {
  const { data, library } = apiItem;
  return {
    itemID: 0,
    libraryID: library.id,
    key: data.key,
    groupID: library.type === "group" ? library.id : null,
    itemType: "note",
    parentItem: data.parentItem ?? "",
    parentItemID: null,
    note: data.note ?? null,
    title: data.title ?? null,
  } as unknown as NoteInfo;
}

export function apiLibraryToLibraryInfo(
  userId: number,
  name = "My Library",
): LibraryInfo {
  return {
    libraryID: userId === 0 ? 1 : userId,
    groupID: null,
    name,
  };
}
