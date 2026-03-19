# Zotero Extension (`zotero-obsidian-note`)

## Overview

Companion extension running inside Zotero. Sends notifications to Obsidian and launches URI actions.

## Push Notifications (Channel B)

The extension HTTP POSTs notification payloads to the Obsidian plugin's background server:

- **Target URL**: read from the `notify-url` preference (default `http://localhost:9091`). **On Windows, `localhost` may resolve to `::1` (IPv6) while the Obsidian server binds to `127.0.0.1` (IPv4 only), causing the POST to fail silently. Users must set `notify-url` to `http://127.0.0.1:9091` on Windows.**
- **Multi-vault**: semicolon-separated URLs in `notify-url` (e.g. `http://localhost:9091;http://localhost:9092`).
- **Endpoint**: `POST /notify` with a JSON body matching `INotifyRegularItem` or other `INotify*` types from `lib/protocol`.

### Prerequisites

The `notify` preference in `prefs.json` **defaults to `false`**. Notifications are only sent when `notify: true`. This is set by the user in Zotero's Obsidian Note preference pane. Without it, no item events are registered and nothing is ever POSTed to the server.

### Debounce (`src/debounced.ts`)

Zotero item change events are debounced at **500 ms** and batched into three queues:
- `add` — newly created items
- `modify` — updated items
- `trash` — trashed/deleted items

Each entry is `[id: number, lib: number, key: string]`. The `key` field is the authoritative identifier; `id` is kept for compatibility.

## URI Protocol Actions (Channel C)

The extension launches `obsidian://zotero/<action>` URIs to trigger Obsidian-side operations. These work regardless of whether `enableServer` is enabled.

| URI action | Trigger |
|---|---|
| `obsidian://zotero/open` | Open the Obsidian note linked to the selected item |
| `obsidian://zotero/export` | Create or update the Obsidian note for the selected item |
| `obsidian://zotero/update` | Refresh an existing Obsidian note |

## Merge Annotations

Triggered when the user selects multiple annotations in the Zotero PDF reader.

- The first annotation in the selection (`annots[0].key`) becomes the merge target.
- The Obsidian plugin embeds `<!--merge:KEY-->` in the annotation comment to track the merge relationship.
- Pattern consumed by Obsidian: `/^<!--merge:(\w+)-->/` (accepts both legacy numeric IDs and string keys).
