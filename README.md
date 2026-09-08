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
4. Select a rendered bol. Yellow marks selection; the underline identifies the primary anchor. **select more** toggles multiple selection; the most recently selected bol anchors rhythm edits.
5. Use the rhythm arrows, drum zones, finger buttons, bayan arrows, and **open / close**. Tags apply to all selected bols. Clicking a tag active on the whole selection removes it. Applying a different choice replaces that group's value. Mixed selections are exposed as `aria-pressed="mixed"`.
6. Add extra notes. Meaningful edits save to this browser on this device. If saving fails, the page shows a persistent warning.
7. **basic** or **complete** copies text and opens a readable preview with an optional WhatsApp link. Complete includes performance annotations. Both include composition notes. No message is sent automatically.

**Undo / redo:** buttons or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. History is held in memory (last 100 edits); nearby note keystrokes form one undo step. Clearing notation requires confirmation and is undoable. It retains the structure, composition type, and notes.

## Rhythm semantics

The immutable sequence is separate from four-level positions: `vibhag : matra : subMatra : subSubMatra`. All rendering and export traverse sequence order, never an address sort.

The rhythm module derives one boundary depth before each bol. It edits these boundaries, then regenerates normalized addresses with no gaps or reversals:

- **Right:** start a new group at the selected bol within its current parent. Disabled at a parent start or where that group boundary already exists.
- **Left:** join the current group's prefix, through the selected bol, to the preceding group in the same parent. Its children stay in order; any remaining suffix stays in its own group. Disabled when there is no preceding group in that parent.
- A matra merge introduces a new subMatra at the old boundary; a subMatra merge introduces a subSubMatra. A subSubMatra merge puts adjacent tokens in the same leaf. Variable subdivision counts are supported.
- Edits of a child level never change positions outside its parent scope. Vibhag edits can renumber subsequent vibhags.

For example, enter `Dha Te Re Ke Te` in a five-matra vibhag. Select `Re`, `Ke`, then the last `Te`, using **matra ←** each time. The result is `| Dha | Te, Re, Ke, Te |`. Select `Re` and use **subMatra ←** for `| Dha | Te/Re, Ke, Te |`.

The configured lengths guide automatic entry: the next bol advances one matra, wrapping to the next vibhag at the configured length. The structure repeats for additional cycles; vibhag addresses continue upward. In free form, use **next vibhag** explicitly. Manual grouping may temporarily contain more matras than the target structure, which is labeled `N entered` beside that row. Committing a different structure preserves the transcribed grouping and sequence, so it can be corrected deliberately. Empty slots are visual guides and are not exported as invented rests.

Hide **subSubMatra** with × and restore with **+ subSubMatra**. Hiding controls never removes or changes rhythmic data.

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
| `js/persistence.js` | Replaceable `loadComposition` / `saveComposition` adapter |
| `js/export.js` | Pure notation export and progressive clipboard helper |
| `js/app.js` | UI event orchestration |

Storage key remains `kaidanotes.composition.v1` for continuity; the current document schema is version 2. Version 1 documents migrate automatically, with the original backed up at `kaidanotes.composition.v1.before-v2`. Old color tags gain their musical meanings. Old compound tokens expand within their existing matra as subdivisions, preserving previously edited parent groups; their annotations are copied to the component bols and the first component retains the original ID. Sequence order is renumbered once during expansion, preserving recited order. Migrated IDs are saved immediately and stay stable on reload. New shortcut entry uses the same advancement as separate taps. A malformed or unsupported document produces an empty sheet and a warning, retaining the stored original until an edit. Selection, drafts, pending boundaries, and undo history remain transient.

The user's clarified execution mapping supersedes the original brief's neutral color labels:

- Orange = **sur**, blue = **kinar**, green = **syahi**, purple = **open tin**. These mutually exclusive choices are stored in `tags.dayanArticulation` and color the bol text.
- Red = **membrane vibration control with right finger 4**, stored separately in `tags.membraneControl`. It adds one red dot without changing the bol's color, fingering, or text. It can coexist with any articulation.
- Finger choices display digits (or digit pairs), never dots. Selecting right finger 4 as part of a fingering does not automatically enable membrane control.

All controls are real buttons with visible focus and accessible names. The portrait phone layout keeps the four type buttons on one row, compacts the drum keyboard, labels the technique controls, fits a typical four-matra vibhag across the screen, and presents rhythm edits as horizontal rows with large arrow buttons. More complex notation can scroll horizontally.

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

Tests use the built-in Node test runner. They cover the brief's cases A–E, randomized boundary edits, local scope, sequence identity, arbitrary structures, compound entry, invalid moves, selection, tag exclusivity, export, persistence failures, schema recovery, and undo/redo.

Append `?debug=1` to show bol addresses. In this mode only, `kaidaDebug.snapshot()` returns a copy of the current composition and `kaidaDebug.exportJSON()` returns formatted JSON. Debug APIs cannot mutate editor state.

## GitHub Pages

The app uses relative asset URLs and supports the `/KaidaNotes/` project path. The workflow validates the application, assembles only public app assets, and deploys on pushes to `main`.

GitHub Pages is enabled with **GitHub Actions** as its source. The live application is <https://mnetzel.github.io/KaidaNotes/>. Push to `main` to validate and publish changes automatically. Alternatively, serve the repository root using GitHub Pages' branch publishing; `.nojekyll` is included.

No compilation is required for deployment. `package.json` and Node.js are development conveniences only. No analytics, server communication, audio timing, playback, accounts, or synchronization are implemented in this MVP.

## Always load fresh

GitHub Pages supplies its own HTTP caching headers (observed `max-age=600`). A scoped, **network-only** service worker in `sw.js` bypasses those cached copies for the HTML document, all JavaScript modules, CSS, the drum image, and favicon. It uses a unique request URL and `fetch(..., { cache: 'no-store' })`, and returns `Cache-Control: no-store`. It never uses Cache Storage or an offline fallback. The worker's own update check uses `updateViaCache: 'none'`.

On first activation, the entire document is replaced once before the editor starts. Every subsequent visit/reload fetches fresh resources. Returning from another phone app/tab, or restoring a page from back/forward history, also replaces the entire page with a unique URL. There is no timed reload while actively editing. Autosaved composition data and the legacy backup remain in localStorage; only transient selection and undo history reset on page navigation, as before. An Internet connection is required when opening or returning to the editor. A failed fresh load offers retry instead of silently using an old application.

This requires HTTPS (or localhost) and service worker support in the browser. A browser still displaying a version from **before** this mechanism was installed needs one initial visit using a new query URL, e.g. `?update=always-fresh`; afterwards the mechanism handles reloads automatically. It does not clear other sites' storage or change GitHub's CDN configuration. Implementation references: [MDN request cache](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache), [service worker registration and updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).
