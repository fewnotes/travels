# Plan: narrow Google Drive OAuth scope via Picker

Not implemented yet. Written down for later.

## Problem

`assets/js/auth.js` currently requests `drive.readonly`:

```js
var GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.readonly ...";
```

Google's consent screen shows this as "See and download all your Google
Drive files" - broader than what the app actually needs (just the
`travels-map-{p,s,t}` folder tree), because `photos.js` finds region
subfolders and their images via open-ended `files.list` name/parent
searches, which `drive.readonly` supports and the narrower `drive.file`
scope does not (by itself).

## Why hardcoded folder IDs don't fix this

`photos.js` already hardcodes each person's root folder ID
(`ROOT_FOLDER_IDS`), but that only skips the "find folder named X" lookup -
it doesn't change what's *authorized*. `drive.file` scope grants access
only to files/folders the user explicitly handed the app via a specific
grant event (app-created file, or picked through Google's Picker widget) -
knowing an ID isn't enough. Region subfolders and photos still need to be
discovered by an open-ended `files.list` query, which requires either
`drive.readonly` or a Picker-based grant on the parent folder.

## The fix: Picker-based folder-level grant

Google's Picker API supports folder selection: when a user picks a
*folder* (not a file), the app gets `drive.file`-scoped access to that
folder **and everything inside it, recursively** - present and future
subfolders/files. This is the standard pattern for "give this app access
to one folder tree, not my whole Drive."

Flow:
1. Each person (owner or shared family member) clicks a one-time "connect
   your travels-map folder" action and picks it via the Picker widget.
2. The picked folder's ID is stored in `localStorage` (per-browser,
   per-person - no backend, consistent with the rest of this static site).
3. `_findGooglePhotos` uses that stored ID instead of (or in addition to)
   the hardcoded `ROOT_FOLDER_IDS` map.
4. `GOOGLE_SCOPE` narrows to `drive.file` (plus the existing identity
   scopes for `userinfo`).

## Recovery from picking the wrong folder

Explicitly rejected: a persistent "change folder" button in the header -
it's clutter for something that's rarely needed.

Instead: no dedicated control at all. Add a contextual link inside the
existing empty state shown when a region has no photos
(`_showModal` / "No photos for this region yet." in `photos.js`):

> No photos for this region yet. Picked the wrong folder? [Change folder]

This only surfaces where and when the problem would actually show up.
Someone who picked correctly never sees it (aside from the acceptable
false-positive case of clicking a region they genuinely haven't visited).

Optional polish: validate the picked folder right after selection - check
whether it contains subfolders matching known region-id patterns (`US-*`,
`CA-*`, ISO country codes) and warn immediately if it doesn't look right,
rather than only surfacing the problem later via empty regions.

## Notes

- One person picking the wrong folder doesn't affect anyone else - each
  person's pick is independent, stored locally, and self-correctable
  without the owner needing to redo any sharing.
- This is additive complexity (Picker script, storage, empty-state UI,
  optional validation) traded for a materially less scary OAuth consent
  screen - worth doing once family members beyond the owner are actually
  using this regularly, not necessarily urgent before then.
