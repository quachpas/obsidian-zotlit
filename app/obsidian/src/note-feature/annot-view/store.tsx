import type { AnnotViewStore } from "@obzt/components";
import { createStore as create } from "@obzt/components";
import type { AttachmentInfo } from "@obzt/database";
import {
  cacheActiveAtch,
  getCachedActiveAtch,
  isAnnotatableAttachment,
} from "@obzt/database";
import { mergeAnnots, mergeTags, mergedToAnnots } from "@/utils/merge";
import type ZoteroPlugin from "@/zt-main";

const getActiveAttachment = (
  cachedKey: string | null,
  attachments: AttachmentInfo[],
) => {
  if (attachments.length === 0) {
    return null;
  }
  if (!cachedKey) {
    return attachments[0];
  }
  return attachments.find((a) => a.key === cachedKey) ?? attachments[0];
};

type PickNonFunctionKeys<T extends Record<string, any>> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [P in keyof T]: T[P] extends Function ? never : P;
}[keyof T];
type PickNonFunction<T extends Record<string, any>> = Pick<
  T,
  PickNonFunctionKeys<T>
>;

export type AnnotViewStoreValues = PickNonFunction<AnnotViewStore>;

const getInitData = (): Partial<AnnotViewStoreValues> => ({
  doc: null,
  allAttachments: null,
  attachmentKey: null,
  annotations: null,
  attachment: null,
  tags: {},
});

const getInit = (): AnnotViewStoreValues => ({
  follow: "zt-reader",
  doc: null,
  allAttachments: null,
  attachmentKey: null,
  annotations: null,
  attachment: null,
  tags: {},
});

const api = (p: ZoteroPlugin) => p.databaseAPI;

export type StoreAPI = ReturnType<typeof createStore>;

export const createStore = (p: ZoteroPlugin) =>
  create<AnnotViewStore>((set, get) => {
    /**
     * @param docItem if provided, load active attachment from localStorage
     */
    const loadAtchs = async (itemKey: string, lib: number) => {
        const attachments = (await api(p).getAttachments(itemKey, lib)).filter(
          isAnnotatableAttachment,
        );
        set((state) => ({
          ...state,
          allAttachments: attachments,
          attachment: getActiveAttachment(state.attachmentKey, attachments),
        }));
      },
      loadDocTags = async (itemKey: string, lib: number) => {
        const docTags = await api(p).getTags([[itemKey, lib]]);
        set((state) => ({ ...state, tags: docTags }));
        return docTags;
      },
      loadAnnots = async (lib: number) => {
        const { attachment } = get();
        if (!attachment) return;
        const annotations = await api(p).getAnnotations(attachment.key, lib);
        const mergedAnnots = mergeAnnots(annotations);
        set((state) => ({
          ...state,
          annotations: mergedToAnnots(mergedAnnots),
          attachment,
        }));
        const annotTags = await api(p).getTags(
          annotations.map((a) => [a.key, lib]),
        );
        const mergedAnnotTags = mergeTags(mergedAnnots, annotTags);
        set((state) => ({
          ...state,
          tags: { ...state.tags, ...mergedAnnotTags },
        }));
      };
    return {
      ...getInit(),
      loadDocItem: async (itemKey, atchKey, lib, force = false) => {
        if (!itemKey) return set(getInitData());
        if (get().doc?.docItem.key === itemKey && !force) return;
        const item = (await api(p).getItems([[itemKey, lib]]))[0];
        if (!item) return set(getInitData());
        const doc = { docItem: item, lib };
        if (!atchKey) {
          const attachmentKey = getCachedActiveAtch(window.localStorage, item);
          set({ ...getInitData(), doc, attachmentKey });
        } else {
          cacheActiveAtch(window.localStorage, item, atchKey);
          set({ ...getInitData(), doc, attachmentKey: atchKey });
        }
        await loadAtchs(item.key, lib);
        await loadDocTags(item.key, lib);
        await loadAnnots(lib);
      },
      refresh: async () => {
        const { doc, attachment } = get();
        if (!doc) return;
        const { docItem, lib } = doc;
        await loadAtchs(docItem.key, lib);
        await loadDocTags(docItem.key, lib);
        if (!attachment) return;
        await loadAnnots(lib);
      },
      setActiveAtch: (key) => {
        const { doc, allAttachments } = get();
        if (!doc) return;
        cacheActiveAtch(window.localStorage, doc.docItem, key);
        if (!allAttachments) {
          set((state) => ({ ...state, attachment: null, attachmentKey: key }));
        } else {
          const activeAtch = getActiveAttachment(key, allAttachments);
          set((state) => ({
            ...state,
            attachment: activeAtch,
            attachmentKey: key,
          }));
        }
      },
      setFollow: (follow) => set({ follow }),
    };
  });
