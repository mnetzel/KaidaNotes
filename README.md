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
3. Tap bols on the drum keyboard. **TeRe**, **KeTe**, and **TaKe** appear in one row and each enter their sequence in one new matra, with separate subMatras and independent bol IDs. The TeReKeTe, GheGhe, TeTe and reverse buttons are hidden; their existing saved data remains supported. Each shortcut is one undo step, and every bol can still be selected, tagged, split into later matras, or joined using the existing arrows. **next vibhag** places the whole grouped shortcut in the first matra of the new vibhag. Previously saved/shared compositions retain their recorded grouping.
4. Tap a rendered bol once to select every identical bol in the composition, twice to select only the tapped bol, and a third time to open a blank replacement slot at the tapped position. Choose a single bol on the keyboard to replace it; compound shortcuts are disabled during replacement. The replacement retains its ID, rhythm, tags and note, and supports undo. **cancel replacement**, Escape, or selecting another bol leaves the original intact. Consecutive taps have no time limit; using another control restarts the count. Yellow marks selection; the underline identifies the primary anchor. **select more** toggles manual multiple selection; the last selected bol anchors rhythm edits. Selecting all matches keeps the tapped bol as anchor.
5. Use the rhythm arrows, drum zones, finger buttons, bayan arrows, and **open / close**. Tags apply to all selected bols. Clicking a tag active on the whole selection removes it. Applying a different choice replaces that group's value. Mixed selections are exposed as `aria-pressed="mixed"`.
6. Add extra notes. Edits are saved on this device and restored after reload. Switching apps or tabs keeps the active editor intact.
7. **link** creates an editable snapshot to copy or send through WhatsApp. The recipient opens the composition, edits it, and creates a new link to send back. **basic** or **complete** copies text and opens a readable preview with an optional WhatsApp link. Complete includes performance annotations. Both include composition notes. No message is sent automatically.

**Undo / redo:** buttons or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. History is held in memory (last 100 edits); nearby note keystrokes form one undo step. **clear** removes only the selected bol's vibhag (or current entry vibhag when nothing is selected), retaining all other rows, structure and notes; it is undoable. Entry resumes in that emptied row. **⌫** removes just the primary selected bol, or the last bol in the current row, and is undoable. **clear all** asks for confirmation, then resets bols, tags, notes, composition type, structure, selection, drafts and undo/redo history. The empty composition replaces the saved document.

## Rhythm semantics

The immutable sequence is separate from four-level positions: `vibhag : matra : subMatra : subSubMatra`. All rendering and export traverse sequence order, never an address sort.

The rhythm module derives one boundary depth before each bol. It edits these boundaries, then regenerates normalized addresses with no gaps or reversals:

- **Right:** start a new group at the selected bol within its current parent. Exception for **matra →**: when the selected bol is alone in its matra, pull in the first bol of the following matra in the same vibhag. Thus `| Ke | Te |` becomes `| KeTe |`; `| Ke | TeRe |` becomes `| KeTe | Re |`. The remaining suffix stays separate, order and annotations are preserved, and undo is available. It never pulls across a vibhag boundary. Other existing boundaries remain disabled.
- **Left:** join the current group's prefix, through the selected bol, to the preceding group in the same parent. Its children stay in order; any remaining suffix stays in its own group. Disabled when there is no preceding group in that parent.
- A matra merge introduces a new subMatra at the old boundary; a subMatra merge introduces a subSubMatra. A subSubMatra merge puts adjacent tokens in the same leaf. Variable subdivision counts are supported.
- Edits of a child level never change positions outside its parent scope. Vibhag edits can renumber subsequent vibhags.

For example, enter `Dha Te Re Ke Te` in a five-matra vibhag. Select `Re`, `Ke`, then the last `Te`, using **matra ←** each time. The written result is `| Dha | TeReKeTe |`. All bols within a matra are joined without spaces, commas or slashes on screen and in Basic export. SubMatra and subSubMatra divisions remain editable and are preserved in shared links. Each bol remains individually selectable. Complete export also joins the bols, with execution annotations attached to their individual bol.

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

All controls are real buttons with visible focus and accessible names. The portrait phone layout proportionally scales the complete 840-pixel design to the available width, preserving drum overlays, finger controls, the horizontal inspector, and notes/share placement. All vibhags share equal-width matra columns, so their separators align vertically. Column count follows the longest configured vibhag (four columns in free form), with a minimum readable width. Several bols in a matra use tighter spacing and smaller text; dense groups wrap inside their cell without widening that row. A typical four-matra vibhag fits across the screen; excess matras scroll horizontally within the notation panel. Resizing or rotating recalculates the scale without resetting the composition.

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

No compilation is required for deployment. `package.json` and Node.js are development conveniences only. No analytics, microphone recording, audio playback, accounts, or live synchronization are implemented.

## Always load fresh

GitHub Pages supplies its own HTTP caching headers (observed `max-age=600`). A scoped, **network-only** service worker in `sw.js` bypasses those cached copies for the HTML document, all JavaScript modules, CSS, the drum image, and favicon. It uses a unique request URL and `fetch(..., { cache: 'no-store' })`, and returns `Cache-Control: no-store`. It never uses Cache Storage or an offline fallback. The worker's own update check uses `updateViaCache: 'none'`.

On first activation, the document is replaced once before the editor starts. Subsequent explicit visits/reloads fetch fresh resources and restore the saved composition. Returning from another app/tab or back/forward history does not reload the page. Worker updates do not interrupt an active editor. There is no timed reload. An Internet connection is needed for a fresh navigation, but switching back to the existing editor does not trigger network loading.

This requires HTTPS (or localhost) and service worker support in the browser. A browser still displaying a version from **before** this mechanism was installed needs one initial visit using a new query URL, e.g. `?update=always-fresh`; afterwards the mechanism handles reloads automatically. It does not clear other sites' storage or change GitHub's CDN configuration. Implementation references: [MDN request cache](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache), [service worker registration and updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).

## Share an editable Kaida

Use **link** beside the text sharing buttons, then **copy link** or **open WhatsApp**. Each link contains the complete composition as a compressed, versioned snapshot: stable IDs and order, individual bols, all four rhythm levels, vibhag structure, type, tags/colors, membrane-control markers, finger annotations, individual and composition notes, and saved UI settings. It also includes a completed clap recording and its Snap setting when available. It does not contain transient selection or undo history. An incoming link restores the shared visibility setting; ordinary reloads still start with sub-submatra controls collapsed.

The URL ends with `#kaida=1.<gzip-base64url>`. Encoding uses the browser's [Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream). The data resides in the link, with no database or link-shortening service. Anyone receiving the complete link can open its snapshot. Edits do not change an already sent link; create another link to send a revision.

Incoming links load automatically and save locally. Undo can restore the previous local composition during that session. After import, the payload is removed from the address bar so a reload preserves subsequent edits instead of reimporting the original snapshot. Use the **link** button to share again. Unreadable, unsupported or oversized links leave the local composition intact and are removed from the address without a persistent notification. Compatible older payloads are normalized using the same importer as saved compositions, without requiring an exact field-for-field match.

The implementation bounds decoded JSON to 1 MB, composition size to 10,000 bols/vibhags on import, and generated URLs to 64,000 characters. Links over 8,000 characters show a reminder to send the complete address; messaging applications may impose their own limits. No content is truncated to fit. Compression/decompression requires a browser supporting CompressionStream and DecompressionStream.

## Entry cursor

A red outline marks the empty matra where the next keyboard entry will go. By default this is after the final bol of the whole composition, regardless of a previously stored entry vibhag. Rhythm edits, replacement, deletion, undo/redo, structure changes, and imported compositions recalculate that endpoint. Selecting an existing bol is independent of the entry cursor.

Click an empty matra to place the cursor there for the next entry. The app preserves intentionally empty matras before it, including across saving and sharing; text export renders their empty columns. After inserting a bol or shortcut, the cursor returns to the global end. Grouped shortcuts occupy one matra; a multi-matra shortcut preserves order by shifting a following occupied matra only if necessary. **next vibhag** shows the destination in advance. **clear** initially places the cursor in the cleared row for refilling.

**Delete Selected Bol**, below **select more**, deletes only the primary selected bol (also when multiple bols are selected) and is disabled when nothing is selected. Later matras retain their positions. Deleting the only bol in a matra leaves a clickable empty cell, including at the end of a row or outside the configured structure; these empty cells survive saving and shared links. A deleted bol within a multi-bol matra does not remove the other bols from that matra. Undo restores it. The existing backspace button remains available. The cursor itself is transient and is not part of the shared notation.

## Clap a tala cycle

At the bottom, **Start clapping** arms the **Clap** button and becomes **Stop clapping**. The first Clap starts a monotonic stopwatch. Tap each intended hit, including pauses, and finish with the next sam. Then press Stop clapping. The closing clap defines the duration but is excluded from the hit count; the first sam is included. Waiting before the first clap or after the last one does not affect the measured duration. At least two taps are needed.

The SVG shows the complete configured tala, split into equal matras and its actual vibhag pattern: thin matra lines, thick vibhag boundaries, bol-colored hit dots, and an open circle for the closing sam. Positions are proportional to measured elapsed time, with half-matra Snap enabled for new recordings and no automatic bol matching. **Snap · ½ matra** optionally rounds each hit to the nearest half matra, at halves and whole matras. Ties round upward. Switching Snap off restores the original positions exactly. Coincident snapped hits remain separate dots; the closing sam remains an endpoint only. Hits retain their exact horizontal timing on two hand lines: right/Dayan above, left/Bayan below. Long tala grids can scroll horizontally. Labels and point tooltips provide the duration and individual timings.

The structure is captured at Start clapping; later notation changes do not reinterpret that recording. A successful new capture replaces the previous one. An incomplete capture retains the previous completed recording. Completed recordings, their captured tala structure and the Snap setting are saved locally and included with the full Kaida link. A recipient can switch between snapped and original timing; snapping never overwrites raw timestamps or changes the bols. Reloading restores the recording; Clear All resets it. An unfinished recording is not shared — links use the last completed capture. Pointer presses are timed on pointerdown, with Space/Enter and assistive activation also supported. This records button presses, not microphone audio. Browser/input latency can affect measured timing.

## Pause

The **← —** and **— →** buttons between the finger controls insert a pause immediately before or after the primary selected bol, in that same matra. They require a selection and do not use the entry cursor. The original bol stays selected for subsequent insertions. The pause is an independent bol with text `—`; rhythm arrows, selection, replacement, deletion, undo, local saving and share links work normally. Existing bols retain their order relative to each other and other matras keep their positions. For a bol within an existing subMatra group, the pause uses a subSubMatra; otherwise it uses a subMatra. Both text exports preserve the dash. This differs from an empty, not-yet-filled matra.

Clap dots are labeled in current notation order, skipping pause bols (—). Labels follow the dots in both original and Snap timing, update after notation edits, and are restored from the composition in shared links. Extra claps remain unlabeled; extra bols are not assigned invented hits. Labels stay on one level above each hand line, using a compact font.

**Clear clapping** beside Snap removes only the saved clap recording and resets its panel. Notation remains intact; future links omit the cleared recording.

The clap plot reads finger annotations only: right-hand fingers put the hit on Dayan, left-hand fingers on Bayan, and both produce two dots at the same time. Unassigned hits remain between the lines; membrane control alone does not indicate a strike. The left **1–5** button marks the whole hand using the existing finger tag field. This visual interpretation never changes recorded times, bol positions, or old annotations.

Clap dots use the same articulation colors as notation bols (including the default dark color) and an 8px radius. Both hand dots share the bol color; unassigned hands retain that color in the middle.

**Vibhags view** toggles between the full tala and one stacked plot per vibhag. Each row retains both hand lines and the same matra width, with continuous matra numbering. Boundary hits belong to the next row; only the last row marks next sam. This display toggle does not alter or save over recording data.

New clap recordings start with Snap enabled; Vibhags view starts enabled when opening the app or clearing clapping. Both remain switchable. Existing recordings and incoming links retain their saved Snap choice.

Notes and sharing are above the composition type selector. The recorded timeline appears above the bottom clapping controls.

**Blocks** is an optional timeline rendering, available alongside the dot view in both tala and stacked vibhag layouts. A block spans from its displayed clap onset to the next onset, or to the closing sam for the final hit. Snap therefore affects both edges; switch it off to see the measured timing, including quarter-matra intervals. Blocks keep bol colors with centered white names, span both hand lines for two-hand strokes, and occupy only the corresponding line for one hand. Unassigned hands appear between lines. Small gaps separate blocks. Durations crossing a vibhag boundary continue on the next row. Coincident snapped hits have zero duration and appear as narrow marks with tooltips. Pauses have no labels or invented hits; this view shows measured intervals rather than deriving durations from notation subdivisions. Switching views never changes the composition or recorded timestamps.

Blocks use a compact layout with only bol names and matra numbers: hand labels, vibhag headings, sam captions and the surrounding summary/legend are hidden. Tight vertical spacing replaces the dot view’s header and footer space.

Timeline matra numbers align with the start boundary. **Presentation View** opens a read-only sheet with the composition title, notation and stacked block timeline. It scales the entire sheet to fit the current screen; long compositions appear smaller. **Presentation Off** (or Escape) restores the editor without changing data, selection or timeline preferences. If no clap recording exists, only notation is shown.

Presentation includes nonempty Extra notes after the block timeline, with a small gap separating notation from blocks. All notation and notes use upright Arial. Block corners use proportional, subtle rounding for one- and two-hand strokes.

## Keyboard design tokens

The bol keyboard follows `redesign buttons.pdf`: opaque cream buttons, black outlines, Iosevka Bold, and PDF-derived positions/shapes. Keyboard styling is scoped in `css/keyboard.css`; saved bol IDs and tag values are unchanged.

| Name | CSS token | Color |
| --- | --- | --- |
| Sur Color | `--sur-color` | `#c77c20` |
| Kinar Color | `--kinar-color` | `#2ba5e6` |
| Syahi Color | `--syahi-color` | `#66c928` |
| Hold Color | `--hold-color` | `#c71e1e` |
| Open Stroke Color | `--open-stroke-color` | `#7d3deb` |
| Keyboard button | `--keyboard-button-color` | `#f3eada` |

Notation colors and timeline blocks/dots reference the same stroke tokens. Hold remains a separate membrane-control marker.
The original Iosevka Bold 34.8.1 webfont is served from `assets/fonts/Iosevka-Bold.woff2`, with its OFL license alongside it. Source: https://github.com/be5invis/Iosevka/releases/tag/v34.8.1 . Google Fonts does not currently serve the Iosevka family, so the original font is bundled rather than substituting another typeface.
