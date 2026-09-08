# KaidaNotes App — Codex Implementation Brief

## 1. Goal

Build a static, client-side web application for quickly entering, structuring, annotating, reviewing, and sharing tabla compositions/phrases.

The current MVP must run entirely in the browser and be deployable to GitHub Pages.

No backend, login, cloud database, or server is required in this phase.

However, the code and data model should be designed so that a backend/cloud sync layer can be added later without rewriting the editor logic.

Use the latest attached PDF design as the visual reference.

The PDF is authoritative for layout and visible controls. This document defines the expected behavior and data model behind that UI.

---

## 2. Technical constraints

Prefer:

- HTML
- CSS
- JavaScript (ES modules)
- no framework unless there is a compelling reason
- no backend
- no build step if avoidable
- browser-local persistence with `localStorage`
- deployable directly to GitHub Pages

Keep the code modular.

Suggested structure:

```text
/
  index.html
  css/
    app.css
  js/
    app.js
    state.js
    model.js
    rhythm.js
    renderer.js
    selection.js
    tags.js
    export.js
    persistence.js
  assets/
    ...
  README.md
```

Do not over-engineer the MVP.

---

## 3. Core concept

This is NOT a normal text editor.

A composition is an ordered sequence of bol objects.

The order of bols never changes.

The user may change:

- rhythmic assignment,
- vibhag,
- matra,
- subMatra,
- subSubMatra,
- technique metadata,
- strike-zone metadata,
- finger metadata,
- open/close metadata,
- other tags,
- composition type,
- vibhag structure,
- extra notes.

The user must never be able to reorder the original bol sequence accidentally.

This is a critical invariant.

---

## 4. Main workflow

The intended workflow is:

1. Choose composition type.
2. Define vibhag structure.
3. Enter bols quickly using the tabla-style keyboard.
4. Use `next vibhag` while entering to start a new vibhag.
5. Review the notation in the lower editor.
6. Select one or more bols.
7. Adjust rhythmic addresses.
8. Add technique/execution tags.
9. Add notes.
10. Share either:
   - basic notation,
   - complete notation.

The app is meant to be fast enough to use live while a tabla teacher dictates a composition.

Speed and low-friction interaction are more important than complex form UI.

---

## 5. Composition types

At the top of the UI:

- Kaida
- Palta
- Rela
- Part Practice

Exactly one is active.

Example state:

```js
compositionType = "kaida";
```

Suggested values:

```js
"kaida"
"palta"
"rela"
"part-practice"
```

The visual active state should match the PDF.

---

## 6. Vibhag structure

The user can define the number of matras in each vibhag using the visible buttons:

- 5
- 4
- 3
- 2

Each click appends one vibhag length.

Example:

```text
4 4 4 4
```

represents:

```js
vibhagStructure = [4, 4, 4, 4];
```

For this structure the UI may recognize and display:

```text
Tintal
```

as shown in the design.

### Buttons

`done`

- commits the current vibhag structure.

`clear`

- clears the vibhag structure being entered.

Do not hard-code the entire app specifically to Tintal.

The model must support arbitrary structures such as:

```js
[3, 2, 4]
[4, 4]
[5, 5, 2]
```

Known talas may be recognized later.

For the MVP, at minimum:

```js
[4, 4, 4, 4] -> "Tintal"
```

Unknown structures may display:

```text
Custom
```

or no tala name.

---

## 7. Bol entry keyboard

The upper half of the design is the input keyboard.

Visible controls include bol buttons such as:

- Ghe
- Ke
- Ki
- Dha
- Dhin
- Dhig
- Te
- Re
- Ti
- Ta
- Tin
- Na
- GheGhe
- GheGhe (reverse)
- TeTe
- TeTe (reverse)
- TeRe / KeTe
- TaKe

Use the exact labels and general placement shown in the latest PDF.

### Important behavior

Each keyboard click appends one new ordered notation token.

Do not reorder previous tokens.

Every appended bol receives:

- a unique stable ID,
- an immutable sequence order,
- a rhythmic position,
- an initially empty tag set.

Example:

```js
{
  id: "bol_00017",
  order: 17,
  text: "Na",
  position: {
    vibhag: 2,
    matra: 4,
    subMatra: 1,
    subSubMatra: 1
  },
  tags: {},
  note: ""
}
```

For MVP, compound keyboard labels may be stored as a single notation token exactly as displayed.

Example:

```js
text: "KeTe"
```

Do not automatically decompose compound buttons unless later explicitly requested.

---

## 8. `next vibhag`

During entry, `next vibhag` means:

> the next bol entered starts a new vibhag.

It must not insert visible text.

It changes the rhythmic assignment of subsequent input.

Example:

```text
Dha Dha Ti Ti
[next vibhag]
Dha Dha Tin Na
```

The next entered bol begins:

```text
vibhag 2
```

The app should automatically reset:

```text
matra = 1
subMatra = 1
subSubMatra = 1
```

for the first bol of the new vibhag.

---

## 9. Immutable bol order

This is one of the most important rules.

Each bol receives an immutable `order`.

Example:

```js
[
  { order: 1, text: "Dha", ... },
  { order: 2, text: "Dha", ... },
  { order: 3, text: "Ti", ... },
  { order: 4, text: "Ti", ... }
]
```

Rhythmic editing may change the addresses.

It must never change:

```text
Dha Dha Ti Ti
```

into:

```text
Dha Ti Dha Ti
```

No drag-and-drop bol reordering is required.

If drag interaction is added later, it must not reorder bols unless the product specification explicitly changes.

---

## 10. Rhythmic address

Every bol has a four-level rhythmic address:

```text
vibhag : matra : subMatra : subSubMatra
```

Example:

```text
2 : 4 : 1 : 1
```

In code:

```js
position: {
  vibhag: 2,
  matra: 4,
  subMatra: 1,
  subSubMatra: 1
}
```

Do not call these `index1`, `index2`, etc. in the code.

Use semantic names.

---

## 11. Meaning of the four levels

### `vibhag`

Top structural rhythmic section.

### `matra`

Beat within a vibhag.

### `subMatra`

Subdivision within a matra.

Different matras may contain different numbers of subMatras.

Example:

```text
| Dha | Te, Re, Ke, Te |
```

could be represented as:

```text
Dha  -> 1:1:1:1

Te   -> 1:2:1:1
Re   -> 1:2:2:1
Ke   -> 1:2:3:1
Te   -> 1:2:4:1
```

There is NO assumption that every matra has the same number of subMatras.

### `subSubMatra`

A further subdivision level.

This is intentionally included for future use and rare special cases.

Most current compositions will use:

```text
subSubMatra = 1
```

for every bol.

The data model must always support it even when the UI hides it.

---

## 12. Rhythmic hierarchy is structural, not duration math

For the current MVP, the address describes hierarchy and ordering.

Do NOT implement absolute timing, BPM, fractions, note duration, swing, or unequal real-time durations yet.

The hierarchy may later be extended to describe more advanced timing.

Do not block future extension.

---

## 13. Address editor

The lower inspector shows the currently selected bol and its current address.

Example from the design:

```text
Na

vibhag      2
matra       4
subMatra    1
subSubMatra 1
```

Each hierarchy level has:

```text
←
→
```

controls.

These are NOT simple numeric steppers.

They represent structural movement while preserving bol order.

The displayed number is the RESULT of the rhythmic structure.

The user edits the rhythmic grouping, not arbitrary raw numbers.

---

## 14. Address-editing invariant

For any two bols `A` and `B`:

```text
A.order < B.order
```

their rhythmic positions must never contradict that order.

Conceptually:

```text
position(A) <= position(B)
```

lexicographically.

Invalid states such as this must never be created:

```text
bol order 15 -> 2:4:3:1
bol order 16 -> 2:2:1:1
```

After every address operation:

1. preserve bol order,
2. normalize affected rhythmic addresses,
3. keep groups contiguous,
4. do not create impossible numbering gaps.

---

## 15. Semantics of address arrows

The arrows should modify rhythmic grouping intelligently.

The selected bol is the anchor.

### General rule

At a chosen hierarchy level, the operation changes where the selected bol belongs in the surrounding rhythmic grouping, then automatically updates affected following bols within the appropriate parent scope.

The exact displayed numbers are recalculated after the structural change.

The user should never manually type address numbers.

### `vibhag ← / →`

Move the selected bol's rhythmic assignment toward the previous or next vibhag boundary while preserving global bol order.

Any necessary following addresses must be renumbered automatically.

Do not move actual bol sequence positions.

### `matra ← / →`

Move the selected bol's assignment toward the previous or next matra within the current vibhag.

Affected following bols in the same vibhag must be updated automatically.

This is conceptually equivalent to moving a matra boundary through the fixed bol sequence.

### `subMatra ← / →`

Move the selected bol's assignment toward the previous or next subMatra inside the current matra.

Only the relevant local parent scope should be changed.

### `subSubMatra ← / →`

Same idea, one hierarchy level deeper.

This level is rarely used.

### Important implementation guidance

Do not implement these buttons as:

```js
position.matra += 1;
```

That would allow structurally invalid addresses.

Instead:

- treat rhythmic units as contiguous groups over the immutable bol sequence,
- move boundaries or reassign contiguous group membership,
- then regenerate normalized addresses.

A small internal boundary/grouping abstraction is acceptable even if the public bol model stores addresses.

---

## 16. Recommended internal rhythm implementation

The public/editor model should expose per-bol addresses.

Internally, it is acceptable and recommended to derive group boundaries from those addresses.

Useful helper functions:

```js
comparePosition(a, b)
normalizePositions(bols, vibhagStructure)
moveBoundary(level, direction, selectedBolId)
getParentScope(level, selectedBolId)
getBolGroup(level, selectedBolId)
isFirstInGroup(level, selectedBolId)
isLastInGroup(level, selectedBolId)
```

Keep rhythm logic isolated in:

```text
js/rhythm.js
```

Do not spread address arithmetic across UI event handlers.

---

## 17. Visualization of rhythmic structure

The notation area must visually match the PDF.

Use vertical blue separators for matra boundaries.

Vibhags are visually separated as rows/sections.

The current design shows four rows for Tintal:

```text
4
4
4
4
```

with each row corresponding to one vibhag.

The notation renderer should derive separators from bol addresses.

Do not store visual separator objects as primary composition data.

Example:

A change from:

```text
1:1:*:*
```

to:

```text
1:2:*:*
```

means a matra separator is rendered between those two groups.

---

## 18. Selection model

Single selection is the default.

Clicking a rendered bol selects it.

Selected bol should use the yellow highlight visible in the PDF.

### `select more`

`select more` enables multi-selection mode.

In multi-selection mode:

- clicking an unselected bol adds it to selection,
- clicking a selected bol removes it,
- technique/tag operations apply to all selected bols.

Keep the immutable sequence order.

Selection is separate from bol data and does not change rhythm automatically.

Suggested state:

```js
selection = {
  multi: false,
  ids: ["bol_00017"]
};
```

---

## 19. Technique / execution metadata

A bol has a base notation identity plus execution metadata.

Example concept:

```text
Dha
```

remains textually `Dha`.

Additional information describes how it is played.

This metadata should not alter the base bol text.

Example:

```js
{
  text: "Dha",
  tags: {
    strikeZone: "kinar",
    finger: "3",
    openClose: "open"
  }
}
```

The exact musical names of all graphic controls are not fully encoded in the PDF, so keep the tag system extensible.

Do not hard-code unnecessary musical assumptions.

---

## 20. Tag groups

Use grouped metadata so mutually exclusive choices replace each other within a group.

Suggested structure:

```js
tags: {
  strikeZone: null,
  leftHandFinger: null,
  rightHandFinger: null,
  bayanDirection: null,
  openClose: null,
  extra: []
}
```

Visible controls in the current design include:

- colored strike areas on the drum graphic,
- left-side finger choices,
- right-side finger choices,
- up/down arrow controls on the left drum,
- `open`,
- `close`.

Use stable internal tag IDs plus human-readable labels.

Example:

```js
{
  id: "strike-zone-orange",
  group: "strikeZone",
  label: "orange zone",
  displayColorKey: "orange"
}
```

The visual color is presentation.

The logical tag should not depend only on a CSS color value.

---

## 21. Applying tags

When one bol is selected:

- clicking a tag control applies it to that bol.

When multiple bols are selected:

- clicking a tag control applies it to every selected bol.

If the clicked tag belongs to a mutually exclusive group:

- replace the previous tag in that group.

Example:

```text
open -> close
```

should not result in:

```text
open + close
```

at the same time.

Repeated clicking on the active tag may optionally toggle it off.

Keep this behavior consistent across tag groups.

---

## 22. Visual encoding of tags

The design uses:

- bol text color,
- small colored markers/dots,
- highlighted background,
- possibly typography differences.

Use the PDF as the visual reference.

Important:

- yellow background = selection state,
- execution colors must remain independent from selection,
- selection must never overwrite the logical tag state.

Do not encode meaningful state only in the DOM or CSS class.

All meaningful state must exist in JavaScript data.

---

## 23. `open` / `close`

The top-right buttons:

```text
open
close
```

act as execution metadata.

Store as a mutually exclusive tag group.

Suggested:

```js
tags.openClose = "open";
```

or:

```js
tags.openClose = "close";
```

Do not alter base bol text.

---

## 24. `clear`

There are visually separate `clear` controls in different sections.

Implement them with local scope.

Do NOT make every `clear` button delete the entire application state.

Examples:

### Keyboard-area clear

Clear the current composition bol sequence after a confirmation if destructive.

### Vibhag-structure clear

Only clear the structure being entered.

If the PDF layout makes the intended scope clear, preserve that scope.

Use confirmation for destructive actions that would remove already-entered notation.

---

## 25. `subSubMatra` visibility

The `subSubMatra` level exists permanently in the data model.

It is rarely needed.

The current design includes an `x` near the `subSubMatra` inspector.

Clicking it hides the `subSubMatra` editor controls from the UI.

It must NOT:

- delete subSubMatra data,
- rewrite positions,
- remove the property from bol objects.

This is presentation only.

Suggested state:

```js
ui: {
  showSubSubMatra: true
}
```

or default it to `false` if that better matches the final intended UI.

Because the user may hide it, provide a minimal non-intrusive way to show it again without changing the general design.

Example:

```text
+ subSubMatra
```

or a small advanced control.

Do not make this visually prominent.

---

## 26. Extra notes

The design contains an `extra notes` text area.

For the MVP, treat this as composition-level notes.

Example:

```js
composition.notes =
  "when played extra fast, play it on sur instead of kinar...";
```

Keep the data model extensible so per-bol notes can be added later if needed.

Do not overload the base bol text with notes.

---

## 27. Persistence

Use `localStorage`.

Autosave after meaningful edits.

Suggested document model:

```js
{
  schemaVersion: 1,
  id: "composition_xxx",
  compositionType: "kaida",
  talaName: "Tintal",
  vibhagStructure: [4, 4, 4, 4],
  notes: "",
  bols: [],
  ui: {
    showSubSubMatra: false
  }
}
```

Keep transient UI state separate where practical:

```js
selection
hover state
temporary vibhag structure input
```

On reload:

- restore the last composition automatically.

Add safe JSON parsing and schema defaults.

Do not allow corrupted localStorage to break the app.

---

## 28. Future backend compatibility

Do not implement backend code now.

But keep persistence behind a small interface.

Example:

```js
saveComposition(composition)
loadComposition()
```

Today:

```text
localStorage
```

Future:

```text
REST API / cloud database / authenticated user storage
```

Editor logic should not care where persistence happens.

---

## 29. WhatsApp / text export

The design contains two share actions:

- basic
- complete

Both should generate plain text suitable for WhatsApp.

The text must be readable without the app.

### Basic export

Contains:

- composition type,
- tala name if known,
- rhythmic grouping,
- bol notation,
- optional extra notes only if appropriate.

Do not include low-level JSON or internal IDs.

### Proposed notation

Use:

- newline = vibhag boundary,
- `|` = matra boundary,
- `,` = subMatra boundary,
- `/` = subSubMatra boundary.

Example:

```text
KAIDA — TINTAL

V1: | Dha | Dha | Ti | Ti |
V2: | Dha | Dha | Tin | Na |
V3: | Ta | Ta | Te, Re | KeTe |
V4: | Dha | Dha | Dhin | Na |
```

For a matra with four subMatras:

```text
| Te, Re, Ke, Te |
```

For a rare subSubMatra case:

```text
| Te/Re, Ke, Te |
```

The notation generator must derive separators from rhythmic addresses.

Do not manually store formatted export text.

---

## 30. Complete export

The complete version includes execution metadata.

Keep it compact and WhatsApp-friendly.

Suggested format:

```text
Dha{kinar; finger=2; open}
```

or another similarly readable deterministic format.

Example:

```text
KAIDA — TINTAL

V1:
| Dha{kinar} | Dha{kinar} | Ti{finger=3} | Ti{finger=3} |

Notes:
when played extra fast, play it on sur instead of kinar...
```

Use human-readable tag labels, not internal IDs or raw CSS colors.

Exact tag labels may evolve.

Create one central tag-label mapping.

---

## 31. Share behavior

When the user clicks the WhatsApp `basic` or `complete` control:

1. generate the corresponding text,
2. copy it to the clipboard,
3. show a small confirmation such as:
   `Copied`,
4. when practical, offer/open WhatsApp share using the generated text.

Do not require WhatsApp to be installed for the feature to work.

Clipboard output is the reliable fallback.

Use progressive enhancement.

---

## 32. Visual design

Follow the latest attached PDF closely.

Important characteristics:

- large tablet-friendly controls,
- tabla image/background in the upper section,
- high-contrast large bol labels,
- purple/pink top controls,
- blue rhythmic separators,
- colored execution notation,
- yellow selection highlight,
- large touch-friendly targets,
- lower rhythmic inspector,
- WhatsApp-style share icons.

This is currently a functional prototype design.

Do not reinterpret it into a generic admin dashboard.

Preserve its physical-instrument / tabla-keyboard feeling.

---

## 33. Responsive behavior

Primary use is likely tablet/desktop landscape or large screen.

Still make the UI usable on narrower screens.

Requirements:

- no overlapping critical controls,
- notation area may horizontally scroll if necessary,
- touch targets remain large,
- no tiny desktop-only interactions,
- avoid hover-only functionality.

Use CSS Grid/Flexbox.

Avoid absolute positioning for the whole page unless required for the drum overlay.

For the tabla keyboard area, relative positioning over the image is acceptable.

---

## 34. Accessibility / input

Minimum requirements:

- buttons must be actual `<button>` elements,
- all controls must have readable text or `aria-label`,
- selected state must not rely only on color,
- keyboard focus should be visible,
- no critical feature should require hover.

Do not over-invest in advanced accessibility for the MVP, but avoid obvious blockers.

---

## 35. Data model

Recommended model:

```js
const composition = {
  schemaVersion: 1,

  id: "composition-001",

  compositionType: "kaida",

  talaName: "Tintal",

  vibhagStructure: [4, 4, 4, 4],

  notes: "",

  bols: [
    {
      id: "bol-001",
      order: 1,
      text: "Dha",

      position: {
        vibhag: 1,
        matra: 1,
        subMatra: 1,
        subSubMatra: 1
      },

      tags: {
        strikeZone: null,
        leftHandFinger: null,
        rightHandFinger: null,
        bayanDirection: null,
        openClose: null,
        extra: []
      },

      note: ""
    }
  ]
};
```

Do not store rendered HTML inside the data model.

---

## 36. Derived state

The following should be derived whenever possible:

- visible matra separators,
- vibhag rows,
- tala label from structure,
- formatted export notation,
- selected visual styling,
- complete export tag strings.

Do not duplicate the same meaning in multiple mutable fields.

---

## 37. Stable IDs vs order

`id`

- permanent identity of a bol object.

`order`

- immutable logical position in the dictated sequence.

Do not use array index as permanent identity.

Example:

```js
id: crypto.randomUUID()
```

or a simple deterministic local ID generator.

The array may remain sorted by `order`.

---

## 38. Normalization

After any rhythm edit, run a normalization pass.

Normalization should guarantee:

- vibhag numbers are contiguous,
- matra numbers are contiguous inside each vibhag,
- subMatra numbers are contiguous inside each matra,
- subSubMatra numbers are contiguous inside each subMatra,
- no child unit exists outside its parent,
- bol order is preserved,
- no invalid reverse addresses appear.

Example:

Bad:

```text
1:1:1:1
1:3:1:1
```

Normalize to:

```text
1:1:1:1
1:2:1:1
```

when appropriate.

---

## 39. Rhythm edit scope

When changing a hierarchy level, only affect the necessary parent scope.

Examples:

Changing:

```text
subMatra
```

must not accidentally reassign another vibhag.

Changing:

```text
matra
```

should primarily affect the current vibhag.

Changing:

```text
vibhag
```

may affect subsequent top-level grouping.

This logic must live in dedicated rhythm functions and be unit-testable.

---

## 40. Multi-selection + rhythm editing

For the first MVP:

- tag editing supports multi-selection,
- rhythm/address editing should operate on the primary/last-selected bol only.

Do not attempt complex simultaneous address edits across disjoint selections.

If multiple bols are selected and the user uses rhythm arrows:

- use the most recently selected bol as the anchor,
- or disable the rhythm arrows until one bol is primary.

Choose one behavior and keep it consistent.

Recommended:

```text
last selected bol = primary anchor
```

---

## 41. Initial composition entry behavior

When entering bols before manual rhythm correction, use a simple predictable default.

Recommended behavior:

- first bol starts at `1:1:1:1`,
- each subsequent bol initially advances to the next matra unless the user is actively entering subMatras,
- `next vibhag` forces the next bol to start a new vibhag.

However, if the intended interaction from the PDF or existing prototype clearly implies another default, prefer the design workflow.

The rhythm editor must make correction fast.

The goal is not to infer complex rhythm automatically.

---

## 42. Important note about entry vs final rhythm

The initial click sequence records the dictated bol order.

The rhythm address may be refined afterward.

Therefore:

```text
bol sequence
```

and:

```text
rhythmic structure
```

must remain separable concepts.

This is fundamental.

---

## 43. Rendering rules

Render bols in immutable `order`.

Never sort bols by editable rhythmic address alone.

Use rhythm addresses only to decide:

- row/vibhag placement,
- separators,
- grouping,
- visual spacing.

This prevents a malformed temporary address from visually reordering the dictated composition.

---

## 44. Error prevention

Prevent invalid operations.

Examples:

- cannot move first bol before vibhag 1,
- cannot create matra 0,
- cannot move a subMatra outside its matra,
- cannot make a later bol appear rhythmically before an earlier bol,
- cannot create empty negative group indices.

Disable impossible arrows rather than allowing then repairing obviously invalid state.

---

## 45. Undo / redo

If straightforward, implement a small in-memory undo/redo stack for editor actions.

Useful actions:

- add bol,
- clear,
- change rhythm boundary,
- apply tag,
- remove tag,
- change notes,
- change vibhag structure.

Keyboard shortcuts:

```text
Ctrl/Cmd + Z
Ctrl/Cmd + Shift + Z
```

This is highly useful during live lesson entry.

If it risks delaying the MVP substantially, keep the architecture ready for it and implement after core behavior.

---

## 46. No backend in MVP

Do NOT implement:

- user accounts,
- authentication,
- database,
- API server,
- cloud sync,
- collaboration,
- payments,
- admin panel.

Those are future features.

---

## 47. Suggested modules

### `model.js`

- composition factory,
- bol factory,
- schema defaults,
- validation helpers.

### `rhythm.js`

- address comparison,
- grouping,
- boundary movement,
- normalization,
- rhythm validation.

### `selection.js`

- selection state,
- primary selection,
- multi-select toggle.

### `tags.js`

- tag definitions,
- group exclusivity,
- tag labels,
- apply/remove operations.

### `renderer.js`

- notation rendering,
- separators,
- selected state,
- technique visuals.

### `export.js`

- basic notation export,
- complete notation export,
- WhatsApp-friendly formatting.

### `persistence.js`

- localStorage adapter,
- schema loading,
- autosave.

### `app.js`

- DOM wiring,
- event orchestration.

---

## 48. Suggested rhythm helper API

Example:

```js
moveSelectedAtLevel({
  composition,
  selectedBolId,
  level: "matra",
  direction: "left"
});
```

Supported levels:

```js
"vibhag"
"matra"
"subMatra"
"subSubMatra"
```

Direction:

```js
"left"
"right"
```

Return a new normalized composition or mutate through one controlled state layer.

Do not directly edit raw DOM state.

---

## 49. Suggested selection API

```js
selectBol(id)
toggleBolSelection(id)
clearSelection()
setMultiSelect(enabled)
getPrimarySelection()
```

---

## 50. Suggested tag API

```js
applyTagToSelection(group, value)
removeTagFromSelection(group)
toggleExtraTag(tagId)
```

---

## 51. Suggested export API

```js
exportBasic(composition)
exportComplete(composition)
shareText(text)
```

Keep export independent from DOM rendering.

---

## 52. Acceptance criteria — core entry

The MVP is successful when:

- user can select Kaida / Palta / Rela / Part Practice,
- user can define `[4,4,4,4]`,
- app displays Tintal,
- user can enter bol sequence using the visible keyboard,
- `next vibhag` starts the next rhythmic section,
- bol sequence is rendered below,
- bol order never changes.

---

## 53. Acceptance criteria — rhythm editor

The MVP is successful when:

- clicking a rendered bol selects it,
- inspector shows its address,
- address is displayed as:
  `vibhag / matra / subMatra / subSubMatra`,
- left/right controls change grouping rather than raw arbitrary numbers,
- later addresses are updated automatically when needed,
- structure stays valid,
- bol order remains unchanged,
- matra boundaries visibly update,
- vibhag rows visibly update.

---

## 54. Acceptance criteria — tags

The MVP is successful when:

- selected bol can receive technique metadata,
- multi-selection can receive the same tag,
- mutually exclusive groups replace previous values,
- selected state and technique state remain separate,
- notation colors/markers update based on metadata,
- base bol text is unchanged.

---

## 55. Acceptance criteria — subSubMatra

The MVP is successful when:

- every bol has `subSubMatra`,
- UI can hide the subSubMatra editor,
- hiding it does not change composition data,
- it can be shown again,
- exports still preserve valid structure.

---

## 56. Acceptance criteria — persistence

The MVP is successful when:

- edits autosave locally,
- page reload restores the composition,
- invalid/corrupt localStorage does not crash the app,
- no server is required.

---

## 57. Acceptance criteria — export

The MVP is successful when:

- Basic generates readable plain-text notation,
- Complete generates readable notation with tags,
- vibhag/matra/subdivision structure is represented,
- output can be copied,
- WhatsApp share is attempted where supported,
- no app-specific IDs appear in shared text.

---

## 58. Testing

At minimum create tests for rhythm logic if a test runner is introduced.

High-value cases:

### Case A — simple four matras

```text
Dha Dha Ti Ti
```

addresses:

```text
1:1:1:1
1:2:1:1
1:3:1:1
1:4:1:1
```

### Case B — four subMatras in one matra

```text
| Dha | Te, Re, Ke, Te |
```

expected:

```text
Dha -> 1:1:1:1

Te  -> 1:2:1:1
Re  -> 1:2:2:1
Ke  -> 1:2:3:1
Te  -> 1:2:4:1
```

### Case C — subSubMatra

Example:

```text
| Dha | Te/Re, Ke |
```

expected:

```text
Dha -> 1:1:1:1
Te  -> 1:2:1:1
Re  -> 1:2:1:2
Ke  -> 1:2:2:1
```

### Case D — immutable order

After any rhythm operation:

```js
bols.map(b => b.order)
```

must remain unchanged.

### Case E — multi-selection tags

Select 3 bols.

Apply:

```text
open
```

All 3 must receive the tag.

No rhythm address should change.

---

## 59. Visual priority

Implement in this order:

1. correct data model,
2. correct bol entry,
3. correct selection,
4. correct rhythm grouping/address logic,
5. correct notation rendering,
6. technique tags,
7. local persistence,
8. export,
9. visual refinement.

Do not begin by spending excessive time on pixel-perfect CSS.

Behavior is more important than exact visual polish in the first pass.

After the editor works, match the latest PDF more closely.

---

## 60. Coding style

Use:

- small pure functions for rhythm logic,
- clear semantic names,
- no magic numeric indices,
- comments only where behavior is non-obvious,
- centralized state updates,
- minimal global variables,
- no duplicated rhythm logic.

Prefer:

```js
position.matra
```

over:

```js
position[1]
```

Prefer:

```js
moveBoundary(...)
```

over directly incrementing nested numbers in UI handlers.

---

## 61. Debug mode

Add an optional development/debug display, disabled by default.

When enabled, show each bol's address.

Example:

```text
Na
2:4:1:1
```

This will be extremely useful while validating rhythm logic.

A query parameter is sufficient:

```text
?debug=1
```

Do not show debug addresses in normal use.

---

## 62. JSON debug export

For development only, optionally allow:

```text
Export JSON
```

or:

```js
console.log(JSON.stringify(composition, null, 2));
```

This is not part of the visible production design.

It is useful for validating state during implementation.

---

## 63. Future extensions — do not implement yet

Design the model so these are possible later:

- login,
- cloud save,
- multiple compositions,
- lessons/playlists,
- teacher/student accounts,
- audio/video attachments,
- server-side sync,
- search,
- tala library,
- bol dictionaries,
- playback,
- metronome,
- tempo,
- exact durations,
- multiple gharana interpretations,
- per-bol alternate technique,
- recording links,
- version history.

Do not implement these now.

---

## 64. Product philosophy

This application is designed around oral tabla teaching.

The teacher may dictate the spoken bol sequence first and then explain performance details separately.

Therefore the app must preserve a strong distinction between:

```text
WHAT is recited
```

and:

```text
HOW it is played
```

The base bol sequence is the recitation.

Tags are performance interpretation.

Rhythmic addresses describe placement.

These are separate layers and should remain separate in both model and UI.

---

## 65. Critical invariants summary

Never violate these:

```text
1. Bol order is immutable.
2. Rhythmic addresses may change.
3. Technique tags do not change bol text.
4. Matras may contain different numbers of subMatras.
5. subSubMatra always exists in data even when hidden in UI.
6. Rhythmic editing must preserve structural validity.
7. Shared notation is derived from data.
8. Visual separators are derived from rhythmic addresses.
9. MVP is fully static/client-side.
10. The latest PDF remains the visual reference.
```

---

## 66. First implementation milestone

Build one fully functioning composition editor page with:

- latest PDF layout,
- composition type buttons,
- vibhag structure input,
- Tintal recognition,
- bol keyboard,
- next vibhag,
- rendered notation,
- single selection,
- multi-selection,
- rhythmic inspector,
- left/right rhythmic editing,
- subSubMatra hide/show,
- execution tags,
- notes,
- localStorage autosave,
- Basic export,
- Complete export.

Do not add routing or multiple pages yet.

---

## 67. Definition of done

The app is done for the first MVP when I can sit in a live online tabla lesson and:

1. select `Kaida`,
2. define `4 4 4 4`,
3. see `Tintal`,
4. click bols as the teacher dictates them,
5. press `next vibhag` between sections,
6. see the entire composition below,
7. click any bol,
8. inspect its address,
9. move its rhythmic assignment without changing bol order,
10. add strike/finger/open-close tags,
11. select several bols and tag them together,
12. add an extra note,
13. reload the page without losing work,
14. click `basic` and get readable WhatsApp notation,
15. click `complete` and get notation including performance annotations.

If these steps work cleanly, the MVP is successful.
