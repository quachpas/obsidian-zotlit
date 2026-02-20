import type { AttachmentInfo, RegularItemInfoBase } from "../index.js";

/**
 * compare sortIndex in format of '123|455|789'
 */

export const sortBySortIndex = (aIdx: number[], bIdx: number[]) => {
  for (let i = 0; i < aIdx.length; i++) {
    if (aIdx[i] !== bIdx[i]) {
      return aIdx[i] - bIdx[i];
    }
  }
  return 0;
};

const annotatable = new Set([
  "application/pdf",
  "text/html",
  "application/epub+zip",
]);

export const isFileAttachment = (i: AttachmentInfo): boolean => Boolean(i.path);
export const isAnnotatableAttachment = (i: AttachmentInfo): boolean =>
  isFileAttachment(i) && !!i.contentType && annotatable.has(i.contentType);

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const toLocalStorageKey = (docItem: RegularItemInfoBase) =>
  `obzt-active-atch-${docItem.key}-${docItem.libraryID}`;

export const getCachedActiveAtch = (
  storage: Storage,
  docItem: RegularItemInfoBase,
): string | null => {
  const raw = storage.getItem(toLocalStorageKey(docItem));
  return raw || null;
};

export const cacheActiveAtch = (
  storage: Storage,
  docItem: RegularItemInfoBase,
  atchKey: string,
) => storage.setItem(toLocalStorageKey(docItem), atchKey);

export const parseSortIndex = (sortIndex: string) =>
  sortIndex?.split("|").map((s) => parseInt(s, 10)) ?? [];
