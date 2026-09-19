# KaidaNotes JSON format

**Export** downloads the full current composition as UTF-8 JSON, with two-space
indentation and a final newline. This is the same uncompressed object carried
by the editable link. It has no additional export wrapper or encoded payload.

The filename joins bol names within each vibhag and separates vibhags with `_`,
for example `DhaTiDhaGheGhe_TinNaKiNa_TaTiDhaGheGhe_DhinNaGheNa.json`.
The composition type, tala heading, notes, and tags are not part of the filename.
Empty compositions use `Kaida.json`; exceptionally long names are shortened for
filesystem compatibility, without shortening the JSON content.

**Import** reads this object, applies the same compatibility/migration logic as
opening a Kaida link, replaces the current composition and updates the tab's URL.
Undo restores the previous composition. File selection cancellation or a failed
import leaves the editor unchanged. Files are processed locally in the browser.

## Top-level fields (schemaVersion 2)

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Format version, currently `2`. Import also supports version `1` through the existing migration. |
| `id` | Composition identifier. |
| `compositionType` | `kaida`, `palta`, `rela`, or `part-practice`. |
| `talaName` | Recognized tala name; recalculated from the structure on import. |
| `vibhagStructure` | Ordered matra counts, for example `[4, 4, 4, 4]`. |
| `notes` | Extra notes, with Unicode and newlines preserved. |
| `bols` | Ordered array of individual bols, including pauses (`"—"`). Compound keyboard shortcuts are already separate bols. |
| `ui` | Stored notation settings: `showSubSubMatra`, optional `entryVibhag`, and optional `emptyMatras` entries (`vibhag`, `matra`). |
| `clapping` | Optional completed clap recording. Absent if none has been recorded. |

Each bol contains `id`, `order`, `text`, `position`, `tags`, and `note`.
The position has four **one-based** integer fields: `vibhag`, `matra`,
`subMatra`, `subSubMatra`. Array order is the musical sequence; do not sort
bols by text or identifiers. A pause is an actual entry, distinct from an empty matra.

## Bol tags

Unset single-value tags are `null`. `extra` is an array of strings.

| Tag | Supported values |
| --- | --- |
| `dayanArticulation` | `sur`, `kinar`, `syahi`, `open-tin` |
| `membraneControl` | `right-4` |
| `leftHandFinger` | `1-5`, `4-and-3`, `2` |
| `rightHandFinger` | `2`, `3-and-4`, `3` |
| `bayanDirection` | `up`, `down` |
| `openClose` | `open`, `close` |
| `extra` | Custom text tags, for example `["quiet"]` |

## Clap recording

`clapping.timestamps` holds raw elapsed **milliseconds**, starting with `0`.
The final timestamp is the next sam (cycle endpoint), not another plotted hit.
`clapping.structure` and `clapping.name` describe the tala at recording time;
they can differ from the composition's subsequently edited structure.
`clapping.snap` is a boolean: snapping rounds the displayed timing to half-matras;
it never changes the raw timestamps.

## Compatibility

Exports preserve every stored composition field. Transient selection, undo history,
in-progress taps, and view-only toggles are not composition data and are not included
in either JSON or the link. Import uses the app's known fields; unknown extension
fields are not retained. Optional older fields receive defaults, duplicate IDs can
be repaired, and legacy compound bols are expanded using the existing migration.

Import accepts up to 10 MiB of JSON, 10,000 bols, and 128 structure entries.
The URL has its own smaller size limit; a large imported composition can still
be exported to a file even if the address cannot hold it.
