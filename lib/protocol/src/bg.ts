export interface INotifyRegularItem {
  event: "regular-item/update";
  add: [id: number, lib: number, key: string][];
  modify: [id: number, lib: number, key: string][];
  trash: [id: number, lib: number, key: string][];
}

export interface INotifyReaderAnnotSelect {
  event: "reader/annot-select";
  updates: [id: number, selected: boolean, key: string][];
}

export interface INotifyActiveReader {
  event: "reader/active";
  itemId: number;
  itemKey: string;
  attachmentId: number;
  attachmentKey: string;
}

export type INotify =
  | INotifyRegularItem
  | INotifyReaderAnnotSelect
  | INotifyActiveReader;
