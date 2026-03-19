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
| `lib/eta/` | `eta-prf` | Embedded JS template engine (fork of eta, used for note templates) |
| `lib/workerpool/` | `@aidenlx/workerpool` | Worker pool (used by annot-block service) |
| `lib/zotero-helper/` | `@aidenlx/zotero-helper` | Zotero plugin dev utilities (used by `app/zotero`) |

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

## Communication Channels (Three-Channel Architecture)

The Obsidian plugin and Zotero extension communicate through three distinct channels:

### Channel A — Zotero Local HTTP API (pull, always available)
- Endpoint: `http://localhost:23119/api/`
- Requires "Allow other applications to communicate with Zotero" in Zotero's Advanced settings.
- Used by `ZoteroApiService` for all item/attachment/annotation data fetches.
- No extension required (built into Zotero).

### Channel B — Background notification server (push, opt-in)
- Endpoint: Obsidian listens on `http://127.0.0.1:9091` (configurable).
- **Disabled by default** (`enableServer: false`). Must be enabled in plugin settings.
- The Zotero extension HTTP POSTs notifications to `/notify`.
- Features that require Channel B: real-time item cache refresh (`INotifyRegularItem`), active reader tracking (`INotifyActiveReader`), annotation selection sync (`INotifyReaderAnnotSelect`).
- Debounce: Zotero debounces at 500 ms (batched into add/modify/trash queues); Obsidian re-debounces at 1 s.

### Channel C — Obsidian URI protocol (Zotero → Obsidian, no server required)
- Zotero extension launches `obsidian://zotero/<action>` URIs directly.
- Actions: `open` (open note), `export` (create/update note), `update` (refresh note).
- No `enableServer` setting required; works whenever Obsidian is running.

### Notification Routing

Not all push notifications go through `DatabaseWorker`:

| Notification type | Interface | Consumer |
|---|---|---|
| Item add/modify/trash | `INotifyRegularItem` | `DatabaseWorker` (connector/service.ts) → item cache refresh |
| Active reader change | `INotifyActiveReader` | `annot-view/view.tsx` directly |
| Annotation selection | `INotifyReaderAnnotSelect` | `annot-view/view.tsx` directly |

`INotifyActiveReader` provides both `itemKey: string` and `attachmentKey: string` (string fields preferred over the legacy `itemId`/`attachmentId`).

### `INotifyRegularItem` shape
```ts
interface INotifyRegularItem {
  event: "regular-item/update";
  add:    [id: number, lib: number, key: string][];
  modify: [id: number, lib: number, key: string][];
  trash:  [id: number, lib: number, key: string][];
}
```
The third element `key` is used for all API calls; `id` is kept for legacy/compatibility only.

## Merge Annotations Feature

The `<!--merge:KEY-->` comment format embeds the **string key** of the merge target annotation:
- Pattern: `/^<!--merge:(\w+)-->/`  (accepts both legacy numeric IDs and new string keys)
- `toMergedAnnotation(comment, mainKey: string, isMain: boolean)` in `lib/protocol/src/symbols.ts`
- The Zotero extension uses `annots[0].key` (not `.id`) as the merge target.
