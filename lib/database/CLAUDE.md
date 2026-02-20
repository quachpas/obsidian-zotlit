# `@obzt/database` — Shared Types + Utilities

## Role After HTTP API Refactoring

The SQL query classes (`Prepared`, `Attachements`, etc.) are no longer used by the main Obsidian plugin, but the **type definitions** remain the shared contract across all packages.

## Key Types

### `RegularItemInfoBase`
Base fields: `itemID`, `libraryID`, `key`, `groupID`, `itemType`, `creators`, `citekey`, `collections`, `dateAccessed`.

### `RegularItemInfo`
`RegularItemInfoBase & Record<string, unknown[]>` — the index signature means **you cannot assign object literals directly** to this type. Use:
```ts
const base: RegularItemInfoBase = { ... };
return Object.assign(base, extra) as unknown as RegularItemInfo;
```

### `AttachmentInfo` (from `sql/attachments.ts`)
Fields: `itemID`, `key`, `path`, `contentType`, `linkMode`, `charsets`, `annotCount`.
**No `libraryID`, `groupID`, or `itemType`** — those were not in the SQL query output.

### `KeyLibID`
```ts
type KeyLibID = [key: string, libraryID: number];
```
Replaces old `IDLibID = [id: number, lib: number]` for all API calls.

## Utilities (`src/utils/misc.ts`)

- `cacheActiveAtch(storage, docItem, atchKey: string)` — stores active attachment key (string) in localStorage
- `getCachedActiveAtch(storage, docItem): string | null` — retrieves cached key
- `isAnnotatableAttachment(i)` — checks `path` and `contentType` only
- `sortBySortIndex(a, b)` — for annotation sort indices

## Building
```bash
cd lib/database && npx tsc
```
Must rebuild after any source changes for the obsidian app to pick up updated types.
