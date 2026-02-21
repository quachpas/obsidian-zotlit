export {
  sortBySortIndex,
  isFileAttachment,
  isAnnotatableAttachment,
  parseSortIndex,
  cacheActiveAtch,
  getCachedActiveAtch,
} from "./utils/misc.js";
export { getCacheImagePath } from "./utils/getCacheImagePath.js";
export type { IDLibID, KeyLibID, ItemIDChecked } from "./utils/database.js";

export { getBacklink } from "./utils/zotero-backlink.js";
export type {
  RegularItemInfo,
  RegularItemInfoBase,
  AnnotationInfo,
  Creator,
  CreatorFullName,
  CreatorNameOnly,
  ItemCreator,
  Collection,
  NoteInfo,
} from "./item.js";
export {
  isCreatorFullName,
  isCreatorNameOnly,
  getCreatorName,
  requiredKeys,
  isAnnotationItem,
  isRegularItemInfo as isGeneralItem,
  isNoteItem,
} from "./item.js";
export type { AttachmentInfo } from "./item.js";
export type { LibraryInfo } from "./item.js";
export type { TagInfo } from "./item.js";
