# Obsidian Plugin (`zotlit`)

## TypeScript Check
```bash
cd app/obsidian && npx tsc --noEmit
```
The tsconfig uses `moduleResolution: "Bundler"`. Workspace packages are resolved from `node_modules/` symlinks created by `rush update`.

## Key Services

| Service                        | File                                          | Role                                                |
| ------------------------------ | --------------------------------------------- | --------------------------------------------------- |
| `ZoteroApiService`             | `src/services/zotero-api/service.ts`          | HTTP client, item cache, FlexSearch index           |
| `DatabaseWorker` (exported as) | `src/services/zotero-db/connector/service.ts` | Orchestrates init/refresh, handles notifications    |
| `ZoteroDatabase`               | `src/services/zotero-db/database.ts`          | High-level search/getItems API used by feature code |
| `Server`                       | `src/services/server/service.ts`              | Local HTTP server (port 9091) receiving push notifications from Zotero extension |

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

| Setting           | Type      | Notes                                                                              |
| ----------------- | --------- | ---------------------------------------------------------------------------------- |
| `zoteroCacheDir`  | `string`  | Default `~/Zotero` — used for annotation image cache paths                         |
| `enableServer`    | `boolean` | Default `false` — must be `true` to receive push notifications from Zotero extension |
| `serverPort`      | `number`  | Default `9091` — port the local HTTP server (Channel B) listens on                |
| `serverHostname`  | `string`  | Default `127.0.0.1` — hostname the local HTTP server binds to                     |

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

## `useSetting` and Null `current`

`useSetting` in `src/setting-tab/components/Setting.tsx` reads `service.current`. Before settings finish loading, `current` is `null`/`undefined`. Using `service.current!` (non-null assertion) only suppresses TypeScript — at runtime it still crashes when the settings tab opens before `SettingsService.load()` completes. Always guard: `const current = service.current; return current != null ? get(current) : undefined`.

## `useSetting` Nested Property Access — Always Use Optional Chaining

Even when `service.current` is non-null, plugged-in settings loaded from disk may be missing nested keys if the user's data predates a version that added them. **Any getter that accesses a nested object or array must use optional chaining and a fallback:**

```ts
// BAD — crashes if template key was absent in older persisted settings
(s) => s.template.folder
(s) => s.template.templates[type]
(s) => s.autoTrim[0]

// GOOD
(s) => s.template?.folder ?? ""
(s) => s.template?.templates?.[type] ?? ""
(s) => s.autoTrim?.[0] ?? false
```

This also applies to setters that read nested keys from `prev`:
```ts
// BAD
(v, prev) => ({ ...prev, template: { ...prev.template, templates: { ...prev.template.templates, [type]: v } } })

// GOOD
(v, prev) => ({ ...prev, template: { ...prev.template, templates: { ...prev.template?.templates, [type]: v } } })
```

Flat top-level properties (`s.logLevel`, `s.enableServer`, etc.) are safe — they return `undefined` on missing keys without throwing.

## `ZoteroApiService` Does Not Use `SettingsService`

After removing `zoteroApiKey`, `ZoteroApiService` no longer needs `SettingsService`. If you add back a settings-derived field, re-add `settings = this.use(SettingsService)` and the import. Do not keep unused `use()` calls — the service container tracks them.

## `skip()` Skips the First Reactive Evaluation

`skip(fn, deps, skipInitial = false)` in `src/settings/base.ts` wraps a reactive effect and skips its first run (when `skipInitial = false`, the default). This means **if a setting is already `true` at plugin load, an effect wrapped with `skip()` will NOT fire on startup** — only on subsequent changes.

**Known instance:** `Server.onload()` registers an `effect(skip(...))` for `enableServer`. Because of this, the server was never started on plugin load when `enableServer` was already saved as `true`. The fix is to add an explicit startup call before registering the reactive effect:
```ts
onload() {
  if (this.enableServer) {
    this.initServer(); // explicit init — skip() won't fire on load
  }
  this.register(effect(skip(...)));
}
```

## `Server` — Content-Type Check Must Use `.includes()`

`Server.requestListener` checks `request.headers["content-type"]` to decide whether to parse a JSON body. Use `.includes("application/json")` rather than `=== "application/json"` — some HTTP clients (including Zotero's fetch) may append `; charset=utf-8`, causing a strict equality check to silently skip JSON parsing and fire the event with no data.

## `SettingTabCtx` Includes `server: Server`

`src/setting-tab/common.tsx` — `SettingTabCtx` exposes `{ settings, app, database, server, closeTab }`. The `server` field (type `Server` from `src/services/server/service.ts`) is supplied in `index.tsx` via `server: this.plugin.server`. Use `useContext(SettingTabCtx).server` in setting-tab components that need to inspect server state.

## Trash + Modify Race Condition in `#handleItemUpdate`

When an item is trashed in Zotero, Zotero fires **both** a `modify` and a `trash` event for the same item key. `DatabaseWorker.#handleItemUpdate` processes all three queues (`add`, `modify`, `trash`) in a single `Promise.all`. If `updateItem` (called for `modify`) completes after `removeItem` (called for `trash`), the item is re-added to the cache and FlexSearch index.

**Fix:** filter trashed keys out of the `add`/`modify` sets before processing:
```ts
const trashedKeys = new Set(data.trash.map(([, , key]) => key));
await Promise.all([
  ...data.add.filter(([, , key]) => !trashedKeys.has(key)).map(...),
  ...data.modify.filter(([, , key]) => !trashedKeys.has(key)).map(...),
  ...data.trash.map(([, , key]) => this.apiService.removeItem(key, lib)),
]);
```
