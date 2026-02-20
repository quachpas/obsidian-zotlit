import type {
  AnnotationInfo,
  AttachmentInfo,
  RegularItemInfoBase,
  TagInfo,
} from "@obzt/database";
import type { StoreApi } from "zustand";

export interface DataModel {
  doc: { docItem: RegularItemInfoBase; lib: number } | null;
  attachment: AttachmentInfo | null;
  attachmentKey: string | null;
  allAttachments: AttachmentInfo[] | null;
  annotations: AnnotationInfo[] | null;
  tags: Record<string, TagInfo[]>;
  loadDocItem(
    itemKey: string,
    attachmentKey: string | null,
    lib: number,
    force?: boolean,
  ): Promise<void>;
  refresh: () => Promise<void>;
  setActiveAtch: (key: string) => void;
  follow: "zt-reader" | "ob-note" | null;
  setFollow: (follow: DataModel["follow"]) => void;
}

export type StoreAPI = StoreApi<DataModel>;
