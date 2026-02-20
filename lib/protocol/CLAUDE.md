# `@obzt/protocol` — IPC Types Between Zotero Extension and Obsidian Plugin

## Notification Types (`src/bg.ts`)

```ts
// Real-time item update from Zotero extension
INotifyRegularItem {
  event: "regular-item/update";
  add:    [id: number, lib: number, key: string][];
  modify: [id: number, lib: number, key: string][];
  trash:  [id: number, lib: number, key: string][];
}

// Reader annotation selection
INotifyReaderAnnotSelect {
  event: "reader/annot-select";
  updates: [id: number, selected: boolean, key: string][];
}

// Active reader item changed
INotifyActiveReader {
  event: "reader/active";
  itemId: number;       // legacy, prefer itemKey
  itemKey: string;
  attachmentId: number; // legacy, prefer attachmentKey
  attachmentKey: string;
}
```

**Use the `key: string` fields everywhere in Obsidian plugin code.** The numeric `id` fields are kept for backward compatibility only.

## Merge Annotation Pattern (`src/symbols.ts`)

```ts
// Matches both old numeric IDs and new string keys
export const mergeAnnotationPattern = /^<!--merge:(\w+)-->/;

// Now takes string key, not number
export function toMergedAnnotation(
  comment: string | null,
  mainKey: string,   // was: mainId: number
  isMain: boolean,
): string
```

The Zotero extension (app/zotero) should pass `annots[0].key` (not `.id`) as the merge target.

## URL Query Types (`src/url.ts`)

`ItemQuery` has both `id: number` (legacy) and `key: string` (preferred). Use `key` when calling `getItems`.
