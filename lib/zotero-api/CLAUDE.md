# `@obzt/zotero-api` — Zotero Local HTTP API Client

## Purpose

Wraps the Zotero 7/8 local HTTP API (`http://localhost:23119/api/`) and transforms responses into the internal types defined in `@obzt/database`.

## Key Exports

- `ZoteroLocalApiClient` — HTTP client (ping, getAllItems, getItem, getChildren, getCollections)
- `apiItemToRegularItemInfo` — `ZoteroApiRegularItem` → `RegularItemInfo`
- `apiAttachmentToAttachmentInfo` — `ZoteroApiAttachmentItem` → `AttachmentInfo`
- `apiAnnotationToAnnotationInfo` — `ZoteroApiAnnotationItem` → `AnnotationInfo`
- `apiNoteToNoteInfo` — `ZoteroApiNoteItem` → `NoteInfo`
- `apiCollectionToCollection` — `ZoteroApiCollection` → `Collection`
- Type guards: `isAnnotationData`, `isNoteData`, `isAttachmentData`

## Transformer Notes

### `apiItemToRegularItemInfo`
- Constructs `base` as `RegularItemInfoBase` (not `RegularItemInfo`) to avoid index signature conflict
- Returns `Object.assign(base, extra) as unknown as RegularItemInfo`
- Extra fields from the API response are wrapped in single-element arrays: `extra[k] = Array.isArray(v) ? v : [v]`
- `itemID` is always `0` (not available via HTTP API)
- `citekey` comes from `data.citationKey` (Zotero 8 native field)
- `dateAccessed` is derived from `data.accessDate` or `data.dateAdded`

### `apiAttachmentToAttachmentInfo`
- `AttachmentInfo` does **not** have `libraryID`, `groupID`, or `itemType` — omit them
- `linkMode` must be mapped from API strings to `AttachmentType` enum via `LINK_MODE_MAP`:
  - `"imported_file"` → `AttachmentType.importedFile` (0)
  - `"imported_url"` → `AttachmentType.importedUrl` (1)
  - `"linked_file"` → `AttachmentType.linkedFile` (2)
  - `"linked_url"` → `AttachmentType.linkedUrl` (3)

### `apiAnnotationToAnnotationInfo`
- API fields use prefix: `annotationType`, `annotationText`, `annotationComment`, `annotationColor`, `annotationPageLabel`
- Internal `AnnotationInfo` fields: `type` (numeric), `text`, `comment`, `color`, `pageLabel`
- `type` mapped via `API_ANNOTATION_TYPE_MAP`: `{highlight:1, note:2, image:3, underline:4, ink:5}`
- Cast result with `as unknown as AnnotationInfo` due to type shape mismatch

## Dependencies
- `@obzt/database` — target types
- `@obzt/common` — utilities
- `@obzt/zotero-type` — `AttachmentType`, `CreatorFieldMode` enums

## Building
```bash
cd lib/zotero-api && npx tsc
```
