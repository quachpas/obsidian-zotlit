import type {
  AnnotationInfo,
  AttachmentInfo,
  KeyLibID,
  LibraryInfo,
  RegularItemInfo,
} from "@obzt/database";

export interface PluginAPI {
  version: string;
  /**
   * Returns the annotations of an attachment by its key.
   */
  getAnnotsOfAtch(
    attachmentKey: string,
    libraryID: number,
  ): Promise<AnnotationInfo[]>;

  /**
   * Gets the document items from the given key+library pairs.
   */
  getDocItems(
    items: KeyLibID[],
  ): Promise<(RegularItemInfo | null)[]>;

  /**
   * Get all annotations with the given keys.
   */
  getAnnotsFromKeys(
    keys: string[],
    libraryID: number,
  ): Promise<Record<string, AnnotationInfo>>;

  getAttachments(docKey: string, libraryID: number): Promise<AttachmentInfo[]>;

  /** Returns citekey → item key mapping */
  getItemKeyFromCitekey(
    citekeys: string[],
    libraryID: number,
  ): Promise<Record<string, string>>;

  getLibs(): Promise<LibraryInfo[]>;
}
