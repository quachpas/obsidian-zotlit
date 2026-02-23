# ZotLit — Obsidian + Zotero Integration Plugin

## Monorepo Structure

Rush monorepo managed with **pnpm 9.5.0**. After adding or removing dependencies run:
```
rush update --bypass-policy
```

### Key Packages

| Path | Package | Role |
|---|---|---|
| `app/obsidian/` | `zotlit` | Obsidian plugin (main deliverable) |
| `app/zotero/` | `zotero-obsidian-note` | Zotero companion extension (runs inside Zotero) |
| `lib/database/` | `@obzt/database` | Shared type definitions + SQLite query helpers (types still used, SQL queries deprecated) |
| `lib/zotero-api/` | `@obzt/zotero-api` | HTTP client + transformers for Zotero local API |
| `lib/protocol/` | `@obzt/protocol` | IPC notification types between Zotero extension and Obsidian |
| `lib/components/` | `@obzt/components` | Shared React UI components (annotation view) |
| `lib/zotero-type/` | `@obzt/zotero-type` | Zotero database schema type definitions |
| `lib/common/` | `@obzt/common` | Shared utilities |
| `lib/ophidian-lib-core/` | `@ophidian/core` | Service container / reactive settings framework |

### Build Commands

```bash
# Type-check a package (no output)
cd app/obsidian && npx tsc --noEmit

# Build a library package (outputs to dist/)
cd lib/<pkg> && npx tsc

# Build obsidian plugin (with dependencies)
rush build -i zotlit

# Full workspace rebuild (verification)
rush rebuild --verbose
```

> **Important:** `lib/` packages must be rebuilt (`npx tsc`) after source changes before the obsidian app picks up the new types, because the TypeScript compiler resolves types from each package's `dist/` directory.

## Architecture: Zotero Local HTTP API

The plugin fetches Zotero data via the **local HTTP API** on `http://localhost:23119/api/`.
(Requires "Allow other applications to communicate with Zotero" enabled in Zotero's Advanced settings.)

### Data Flow
```
Zotero Local API (port 23119)
        ↓ async HTTP fetch
   ZoteroApiService  (app/obsidian/src/services/zotero-api/service.ts)
   ├─ FlexSearch in-memory index
   ├─ Item cache: Map<libraryID, Map<key, RegularItemInfo>>
   └─ On-demand fetch for annotations / notes / attachments
```

`DatabaseWorker` (connector/service.ts) wraps `ZoteroApiService` and handles initialization, refresh, and real-time update notifications from the Zotero extension.

### Primary Item Identifier

Items are identified by their **8-character alphanumeric Zotero key** (e.g. `"AB12CD34"`), not by numeric `itemID`.
- `itemID` is always `0` for HTTP API–sourced items.
- `KeyLibID = [key: string, libraryID: number]` is the standard pair type (replaces old `IDLibID = [id: number, lib: number]`).

## Real-Time Notifications

The Zotero extension sends `INotifyRegularItem` via the local server:
```ts
interface INotifyRegularItem {
  event: "regular-item/update";
  add:    [id: number, lib: number, key: string][];
  modify: [id: number, lib: number, key: string][];
  trash:  [id: number, lib: number, key: string][];
}
```
The third element `key` is used for all API calls; `id` is kept for legacy/compatibility only.

`INotifyActiveReader` provides both `itemKey: string` and `attachmentKey: string` (string fields preferred over the legacy `itemId`/`attachmentId`).

## Merge Annotations Feature

The `<!--merge:KEY-->` comment format embeds the **string key** of the merge target annotation:
- Pattern: `/^<!--merge:(\w+)-->/`  (accepts both legacy numeric IDs and new string keys)
- `toMergedAnnotation(comment, mainKey: string, isMain: boolean)` in `lib/protocol/src/symbols.ts`
- The Zotero extension uses `annots[0].key` (not `.id`) as the merge target.
