import type { DB } from "@obzt/zotero-type";
import { nonRegularItemTypes } from "@obzt/zotero-type";

export { nonRegularItemTypes };

/** not nullable Items.itemID */
export type ItemIDChecked = Exclude<DB.Items["itemID"], null>;

export type IDLibID = [id: number, libId: number];
export type KeyLibID = [key: string, libId: number];
