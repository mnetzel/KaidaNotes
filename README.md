# KaidaNotes

A static tabla composition editor for live lessons, implemented from the supplied **KaidaNotes App — Codex Implementation Brief** and **KaidaNotes Design.pdf**. No framework, runtime dependency, build step, backend, login, or cloud storage.

## Run

With Node.js 22 or newer:

```sh
npm start
```

Open <http://localhost:4173/KaidaNotes/>. Any static HTTP server also works. Serve the files over HTTP rather than opening `index.html` with `file://`, because the application uses JavaScript modules. Clipboard access works on localhost and HTTPS; a selectable text preview is available when permission is denied.

## Use during a lesson

1. Choose Kaida, Palta, Rela, or Part Practice. An empty Tintal sheet is ready initially.
2. Tap structure numbers to create a new draft, then **done**. `4 4 4 4` is recognized as Tintal. **clear** beside the numbers only clears the draft; **done** with an empty draft enables free-form entry.
3. Tap bols on the drum keyboard. Compound buttons are shortcuts for sequential individual taps: **GheGhe** enters `Ghe Ghe`, **TeTe** enters `Te Te`, **TeReKeTe** enters `Te Re Ke Te`, and **TaKe** enters `Ta Ke`. Each resulting bol has its own permanent ID and order and can be selected, grouped, and tagged independently. A shortcut is one undo step. Reverse buttons retain the same recited syllables; they do not guess an unspecified fingering. **next vibhag** applies to the first bol of the shortcut, with normal entry continuing for the remaining bols.
4. Tap a rendered bol once to select it, twice to select every identical bol in the composition, and a third time to open a blank replacement slot at the tapped position. Choose a single bol on the keyboard to replace it; compound shortcuts are disabled during replacement. The replacement retains its ID, rhythm, tags and note, and supports undo. **cancel replacement**, Escape, or selecting another bol leaves the original intact. Consecutive taps have no time limit; using another control restarts the count. Yellow marks selection; the underline identifies the primary anchor. **select more** toggles manual multiple selection; the last selected bol anchors rhythm edits. Selecting all matches keeps the tapped bol as anchor.
5. Use the rhythm arrows, drum zones, finger buttons, bayan arrows, and **open / close**. Tags apply to all selected bols. Clicking a tag active on the whole selection removes it. Applying a different choice replaces that group's value. Mixed selections are exposed as `aria-pressed="mixed"`.
6. Add extra notes. Edits are saved on this device and restored after reload. Switching apps or tabs keeps the active editor intact.
7. **link** creates an editable snapshot to copy or send through WhatsApp. The recipient opens the composition, edits it, and creates a new link to send back. **basic** or **complete** copies text and opens a readable preview with an optional WhatsApp link. Complete includes performance annotations. Both include composition notes. No message is sent automatically.

**Undo / redo:** buttons or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. History is held in memory (last 100 edits); nearby note keystrokes form one undo step. **clear** removes only the selected bol's vibhag (or current entry vibhag when nothing is selected), retaining all other rows, structure and notes; it is undoable. Entry resumes in that emptied row. **⌫** removes just the primary selected bol, or the last bol in the current row, and is undoable. **clear all** asks for confirmation, then resets bols, tags, notes, composition type, structure, selection, drafts and undo/redo history. The empty composition replaces the saved document.

## Rhythm semantics

The immutable sequence is separate from four-level positions: `vibhag : matra : subMatra : subSubMatra`. All rendering and export traverse sequence order, never an address sort.

The rhythm module derives one boundary depth before each bol. It edits these boundaries, then regenerates normalized addresses with no gaps or reversals:

- **Right:** start a new group at the selected bol within its current parent. Disabled at a parent start or where that group boundary already exists.
- **Left:** join the current group's prefix, through the selected bol, to the preceding group in the same parent. Its children stay in order; any remaining suffix stays in its own group. Disabled when there is no preceding group in that parent.
- A matra merge introduces a new subMatra at the old boundary; a subMatra merge introduces a subSubMatra. A subSubMatra merge puts adjacent tokens in the same leaf. Variable subdivision counts are supported.
- Edits of a child level never change positions outside its parent scope. Vibhag edits can renumber subsequent vibhags.

For example, enter `Dha Te Re Ke Te` in a five-matra vibhag. Select `Re`, `Ke`, then the last `Te`, using **matra ←** each time. The result is `| Dha | Te, Re, Ke, Te |`. Select `Re` and use **subMatra ←** for `| Dha | Te/Re, Ke, Te |`.

Each keyboard entry advances one matra within the current vibhag, even beyond its configured length. Only **next vibhag** makes the next entry start a new vibhag; repeated presses before entry have the same effect as one press. A target of 4 remains 4 when entering 5, 6 or more matras, and its circle turns red on overflow. The structure repeats for additional vibhags; their addresses continue upward. Committing a different structure preserves the transcribed grouping and sequence, so it can be corrected deliberately. Empty slots are visual guides and are not exported as invented rests.

The optional **subSubMatra** controls start hidden on each page load, including when restoring a saved composition. Show them with the small **+** icon and hide them with **×**. Hiding controls never removes or changes rhythmic data. Disabled controls keep opaque backgrounds and use muted text to indicate their state.

## Architecture

| Module | Responsibility |
| --- | --- |
| `js/model.js` | Factories, stable IDs, schema defaults, tala recognition |
| `js/keyboard.js` | Compound shortcuts expanded into individual bols |
| `js/talas.js` | Common tala structures and shared-structure alternatives |
| `js/rhythm.js` | Pure boundary operations, normalization, validation, entry cursor |
| `js/selection.js` | Transient selection and primary anchor |
| `js/tags.js` | Central extensible definitions, exclusivity, human-readable labels |
| `js/state.js` | Controlled updates and undo/redo |
| `js/renderer.js` | DOM creation, notation groups, inspector and tag state |
| `js/persistence.js` | Restore and save the current composition locally |
| `js/share-link.js` | Versioned compressed links and validated import |
| `js/export.js` | Pure notation export and progressive clipboard helper |
| `js/layout.js` | Proportional portrait layout sizing |
| `js/app.js` | UI event orchestration |

The latest user request restores local autosave. `js/persistence.js` saves edits to this app's localStorage key and validates saved compositions on startup. Empty vibhags retain their row numbers. Other applications' storage is untouched. If storage is blocked, editing remains available in memory and the status indicates that copying is needed to keep work. Undo history and selection remain transient.

The user's clarified execution mapping supersedes the original brief's neutral color labels:

- Orange = **sur**, blue = **kinar**, green = **syahi**, purple = **open tin**. These mutually exclusive choices are stored in `tags.dayanArticulation` and color the bol text.
- Red = **membrane vibration control with right finger 4**, stored separately in `tags.membraneControl`. It adds one red dot without changing the bol's color, fingering, or text. It can coexist with any articulation.
- Finger choices display digits (or digit pairs), never dots. Selecting right finger 4 as part of a fingering does not automatically enable membrane control.

All controls are real buttons with visible focus and accessible names. The portrait phone layout proportionally scales the complete 840-pixel design to the available width, preserving drum overlays, finger controls, the horizontal inspector, and notes/share placement. A typical four-matra vibhag fits across the screen; longer notation scrolls horizontally within its panel. Resizing or rotating recalculates the scale without resetting the composition.

## Tala recognition

Recognition uses the complete vibhag pattern, not just the beat count:

| Main suggestion | Pattern | Other supported names sharing this grouping |
| --- | --- | --- |
| Tintal | 4–4–4–4 | Tilwara, Sitarkhani, Panjabi |
| Kaherwa | 4–4 | Dhumali |
| Dadra | 3–3 | |
| Rupak | 3–2–2 | Pashto |
| Jhaptal | 2–3–2–3 | |
| Ektal | 2–2–2–2–2–2 | Chautal |
| Deepchandi | 3–4–3–4 | Jhumra |
| Dhamar | 5–2–3–4 | |
| Sultal | 2–2–2–2–2 | |

The main suggestion appears above the notation and in exports; matching alternatives are shown beside it because a grouping alone cannot uniquely identify a theka. Unknown patterns remain Custom. Structure references: [DigiTabla's tala reference](https://digitabla.com/reference/tals-and-thekas/extended-list/).

The supplied tabla image is extracted from the user's design PDF and stored locally as `assets/tabla.jpg`; there are no third-party asset or font requests.

## Verification

```sh
npm test
npm run check
```

Tests use the built-in Node test runner. They cover the brief's cases A–E, randomized boundary edits, local scope, sequence identity, arbitrary structures, compound entry, invalid moves, selection, tag exclusivity, export, local restoration, scoped deletion, full reset, schema recovery, and undo/redo.

Append `?debug=1` to show bol addresses. In this mode only, `kaidaDebug.snapshot()` returns a copy of the current composition and `kaidaDebug.exportJSON()` returns formatted JSON. Debug APIs cannot mutate editor state.

## GitHub Pages

The app uses relative asset URLs and supports the `/KaidaNotes/` project path. The workflow validates the application, assembles only public app assets, and deploys on pushes to `main`.

GitHub Pages is enabled with **GitHub Actions** as its source. The live application is <https://mnetzel.github.io/KaidaNotes/>. Push to `main` to validate and publish changes automatically. Alternatively, serve the repository root using GitHub Pages' branch publishing; `.nojekyll` is included.

No compilation is required for deployment. `package.json` and Node.js are development conveniences only. No analytics, server communication, audio timing, playback, accounts, or synchronization are implemented in this MVP.

## Always load fresh

GitHub Pages supplies its own HTTP caching headers (observed `max-age=600`). A scoped, **network-only** service worker in `sw.js` bypasses those cached copies for the HTML document, all JavaScript modules, CSS, the drum image, and favicon. It uses a unique request URL and `fetch(..., { cache: 'no-store' })`, and returns `Cache-Control: no-store`. It never uses Cache Storage or an offline fallback. The worker's own update check uses `updateViaCache: 'none'`.

On first activation, the document is replaced once before the editor starts. Subsequent explicit visits/reloads fetch fresh resources and restore the saved composition. Returning from another app/tab or back/forward history does not reload the page. Worker updates do not interrupt an active editor. There is no timed reload. An Internet connection is needed for a fresh navigation, but switching back to the existing editor does not trigger network loading.

This requires HTTPS (or localhost) and service worker support in the browser. A browser still displaying a version from **before** this mechanism was installed needs one initial visit using a new query URL, e.g. `?update=always-fresh`; afterwards the mechanism handles reloads automatically. It does not clear other sites' storage or change GitHub's CDN configuration. Implementation references: [MDN request cache](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache), [service worker registration and updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).

## Share an editable Kaida

Use **link** beside the text sharing buttons, then **copy link** or **open WhatsApp**. Each link contains the complete composition as a compressed, versioned snapshot: stable IDs and order, individual bols, all four rhythm levels, vibhag structure, type, tags/colors, membrane-control markers, finger annotations, individual and composition notes, and saved UI settings. It does not contain transient selection or undo history. An incoming link restores the shared visibility setting; ordinary reloads still start with sub-submatra controls collapsed.

The URL ends with `#kaida=1.<gzip-base64url>`. Encoding uses the browser's [Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream). The data resides in the link, with no database or link-shortening service. Anyone receiving the complete link can open its snapshot. Edits do not change an already sent link; create another link to send a revision.

Incoming links load automatically and save locally. Undo can restore the previous local composition during that session. After import, the payload is removed from the address bar so a reload preserves subsequent edits instead of reimporting the original snapshot. Use the **link** button to share again. Invalid, unsupported, truncated or oversized links show an error without replacing the local composition. The codec rejects validation that would silently change document contents.

The implementation bounds decoded JSON to 1 MB, composition size to 10,000 bols/vibhags on import, and generated URLs to 64,000 characters. Links over 8,000 characters show a reminder to send the complete address; messaging applications may impose their own limits. No content is truncated to fit. Compression/decompression requires a browser supporting CompressionStream and DecompressionStream.
