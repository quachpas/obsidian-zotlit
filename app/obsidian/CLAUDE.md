# Obsidian Plugin (`zotlit`)

## TypeScript Check
```bash
cd app/obsidian && npx tsc --noEmit
```
The tsconfig uses `moduleResolution: "Bundler"`. Workspace packages are resolved from `node_modules/` symlinks created by `rush update`.

## Key Services

| Service | File | Role |
|---|---|---|
| `ZoteroApiService` | `src/services/zotero-api/service.ts` | HTTP client, item cache, FlexSearch index |
| `DatabaseWorker` (exported as) | `src/services/zotero-db/connector/service.ts` | Orchestrates init/refresh, handles notifications |
| `ZoteroDatabase` | `src/services/zotero-db/database.ts` | High-level search/getItems API used by feature code |

`plugin.databaseAPI` → `DatabaseWorker.api` → `ZoteroApiService` instance.

## Type Constraints

### `RegularItemInfo`
Defined as `RegularItemInfoBase & Record<string, unknown[]>`. The index signature (`unknown[]`) conflicts with the base fields (`itemID: number`, etc.). **Do not assign an object literal directly** to `RegularItemInfo` — always cast:
```ts
const base: RegularItemInfoBase = { ... };
return Object.assign(base, extra) as unknown as RegularItemInfo;
```

### `AttachmentInfo`
Only has: `itemID`, `key`, `path`, `contentType`, `linkMode`, `charsets`, `annotCount`.
**Does NOT have** `libraryID`, `groupID`, `itemType`. These fields were SQLite artifacts.

### `AttachmentType` enum
`linkMode` is a numeric enum (`AttachmentType.importedFile = 0`, etc.). The Zotero API returns strings like `"imported_file"`. Map via `LINK_MODE_MAP` in `lib/zotero-api/src/transformers.ts`.

### Tags
`Record<string, TagInfo[]>` throughout (was `Record<number, TagInfo[]>`). Keys are annotation/item string keys.

## Settings

| Setting | Type | Notes |
|---|---|---|
| `zoteroCacheDir` | `string` | Default `~/Zotero` — used for annotation image cache paths |

The Zotero API port is hardcoded to `23119` (not configurable).

`zoteroDataDir` was removed. Use `zoteroCacheDir` everywhere (template helpers, img-import service).

## FlexSearch Setup

`ZoteroApiService` uses FlexSearch with internal module imports. A companion declaration file is required:
- `src/services/zotero-api/flexsearch-extra.d.ts` — declares `flexsearch/src/document`, `flexsearch/src/lang/en.js`, `flexsearch/src/lang/latin/default.js`
- `flexsearch` and `@types/flexsearch` must be in `package.json` dependencies.

## Worker Pools

`@aidenlx/workerpool` is still used by the **annot-block** feature (`src/services/annot-block/service.ts`) for rendering annotation blocks. It is **not** used for database access (that was removed). Keep it in `package.json`.

## HTTP Requests — Use `requestUrl`, Not `fetch`

The browser `fetch` API is subject to CORS and will be blocked when calling `http://localhost:23119/api` from the `app://obsidian.md` origin. Always use **Obsidian's `requestUrl`** for HTTP requests inside the plugin:

```ts
import { requestUrl } from "obsidian";
const res = await requestUrl({ url, headers, throw: false });
// res.status, res.headers (Record<string,string>), res.json (parsed), res.text (string)
```

`requestUrl` uses Electron's Node.js networking stack and is exempt from CORS.

The `ZoteroLocalApiClient` accepts a `fetchFn?: FetchFn` option. The `obsidianFetch` adapter in `src/services/zotero-api/service.ts` bridges `requestUrl`'s response shape to the `FetchResponse` interface expected by the client. **All client instances must pass `fetchFn: obsidianFetch`**.

## getLibs() is Synchronous

`ZoteroApiService.getLibs()` returns `LibraryInfo[]` synchronously. When used with `useRefreshAsync` or similar promise-based hooks, wrap it:
```ts
useRefreshAsync(() => Promise.resolve(database.api.getLibs()), [])
```

## Protocol Query Handler

`src/note-feature/protocol/service.ts` — when handling `obsidian://zotero/open` URLs, use `query.items[0].key` (string) not `query.items[0].id` (number) when calling `getItems`.

## Topic Import

`INotifyRegularItem.add` is `[id, lib, key][]`. Map to `KeyLibID[]` before passing to `createNote`:
```ts
data.add.map(([, lib, key]) => [key, lib] as [string, number])
```

## Pre-existing Mock Type Errors

`lib/components/src/mock/note-fields.tsx` has pre-existing TypeScript errors unrelated to the HTTP API refactoring. Do not worry about these.
