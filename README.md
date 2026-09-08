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
3. Tap bols on the drum keyboard. Each click appends one token with its own permanent ID and order, including compound and reverse labels. **next vibhag** arms a boundary for the next bol; clicking again cancels it. Repeated boundary clicks never create empty vibhags.
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
| `js/rhythm.js` | Pure boundary operations, normalization, validation, entry cursor |
| `js/selection.js` | Transient selection and primary anchor |
| `js/tags.js` | Central extensible definitions, exclusivity, human-readable labels |
| `js/state.js` | Controlled updates and undo/redo |
| `js/renderer.js` | DOM creation, notation groups, inspector and tag state |
| `js/persistence.js` | Replaceable `loadComposition` / `saveComposition` adapter |
| `js/export.js` | Pure notation export and progressive clipboard helper |
| `js/app.js` | UI event orchestration |

Storage key: `kaidanotes.composition.v1`. A malformed or unsupported document produces a usable empty sheet and a warning; the original stored value is not replaced until an edit. Known schema fields are sanitized. Selection, structure drafts, pending entry boundaries, and undo history are transient. Persistence is isolated so a future remote adapter can replace it without changing rhythm logic.

Zone labels deliberately remain neutral (orange/green/blue/purple/red zone), since the PDF does not identify all musical names. Change definitions in `tags.js` when the intended names are confirmed. Strike color, selection, finger markers, direction, and open/close state remain independent. All controls are real buttons with visible focus and accessible names.

The supplied tabla image is extracted from the user's design PDF and stored locally as `assets/tabla.jpg`; there are no third-party asset or font requests. Narrow screens rearrange the drum controls into a touch-friendly grid. Notation can scroll horizontally.

## Verification

```sh
npm test
npm run check
```

Tests use the built-in Node test runner. They cover the brief's cases A–E, randomized boundary edits, local scope, sequence identity, arbitrary structures, compound entry, invalid moves, selection, tag exclusivity, export, persistence failures, schema recovery, and undo/redo.

Append `?debug=1` to show bol addresses. In this mode only, `kaidaDebug.snapshot()` returns a copy of the current composition and `kaidaDebug.exportJSON()` returns formatted JSON. Debug APIs cannot mutate editor state.

## GitHub Pages

The app uses relative asset URLs and supports the `/KaidaNotes/` project path. The workflow validates the application, assembles only public app assets, and deploys on pushes to `main`.

Enable **Settings → Pages → Build and deployment → Source: GitHub Actions** in `mnetzel/KaidaNotes`. Run the workflow or push to `main`. The expected address is <https://mnetzel.github.io/KaidaNotes/> once the deployment succeeds. Alternatively, serve the repository root from `main` using GitHub Pages' branch publishing. `.nojekyll` is included.

No compilation is required for deployment. `package.json` and Node.js are development conveniences only. No analytics, server communication, audio timing, playback, accounts, or synchronization are implemented in this MVP.
