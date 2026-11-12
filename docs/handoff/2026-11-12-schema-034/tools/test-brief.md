# Brief: migrate failing tests of one package to the v0.34 vocabulary

Repository: /workspace/opf (branch `claude/elegant-bell-2g5ks5`, already checked out). The engine source, schemas, examples and docs are already migrated and BUILT. Your job: make the listed failing test files of ONE package pass again by migrating their fixtures and expectations to the new vocabulary. Tests only.

## Hard rules

- Edit ONLY files under the package's `test/` directory (and its `test/fixtures` JSON/YAML/Markdown text fixtures). Never edit `src/`, `dist/`, `spec/`, `examples/`, `docs/`, other packages, or binary fixtures (`.pptx`, `.png`, ...).
- Never commit, push, stash, reset, checkout or switch branches. Never run `pnpm build`, `pnpm test`, `pnpm install` or any whole-suite command. Run single test files only, from the package directory, exactly as listed (for example `cd /workspace/opf/packages/javascript && node --test test/foo.test.mjs`, or `node test/foo.mjs` for files that are not `*.test.mjs`).
- Never weaken a test: do not delete assertions, skip, `todo`, loosen tolerances, or replace an expected value with whatever the code now returns unless the difference is exactly a vocabulary word from the table below. If a failure is NOT explained by the vocabulary change (a geometry number moved, a different error, a crash in `src`), STOP on that file, leave it as it is, and report it with the failing assertion and your diagnosis.
- Do not touch golden hash files (`packages/render/test/golden/**`).
- Other agents are editing other packages' tests at the same time. Stay inside your package.

## The vocabulary change (documents; no aliases)

LOGICAL `left`/`right` became `start`/`end` (`center` unchanged). `start` is the left edge in a left-to-right deck and the right edge in a right-to-left deck.

| Where (in an OPF document or record) | Before | After |
| --- | --- | --- |
| `design.titleAlignment`, `design.contentAlignment` (deck, slide, theme `design`, layout `design`; also the compose options `titleAlignment` / `contentAlignment` and `resolveDesignHints({deck:{...}})`) | `left`, `center`, `right` | `start`, `center`, `end` |
| `design.chartPrimary` | `none`, `top`, `bottom`, `left`, `right` | `none`, `top`, `bottom`, `start`, `end` |
| header/footer zones `design.header.*`, `design.footer.*` | keys `left`, `center`, `right` | keys `start`, `center`, `end` |
| promoted slide regions | `left`, `right`, `left+center`, `center+right`, `left+center+right`, `top:left`, `middle+bottom:center+right`, ... | `start`, `end`, `start+center`, `center+end`, `start+center+end`, `top:start`, `middle+bottom:center+end`, ... |
| Markdown block option | `region=left` | `region=start` |
| `caption.align`, table cell `style.align` | `left`, `center`, `right` | `start`, `center`, `end` |
| image `placement.edge`, `overlay.edge` (overlay band of an image or background) | `left`, `right`, `top`, `bottom` | `start`, `end`, `top`, `bottom` |
| reserved layout region names | `left`, `right` reserved | `start`, `end` reserved (`left`, `right` are now ordinary names) |
| text run language | `{ text, lang: 'fr' }` | `{ text, language: 'fr' }` (Markdown span attribute stays `lang=fr`) |

Paths follow the keys: `slides.0.left.text` -> `slides.0.start.text`, `/slides/0/left` -> `/slides/0/start`, `design.footer.right.text` -> `design.footer.end.text`, `/slides/0/text/1/lang` -> `/slides/0/text/1/language`.

What engines REPORT (so expected values in tests change the same way):
- `resolveDesignHints(...)` and `composeSlide(...).design` (`geometry.design`) report the document's words: `titleAlignment: 'start'`, `chartPrimary: 'end'`.
- Composed header/footer parts (`geometry.furniture.parts[]`) have `zone: 'start' | 'center' | 'end'` and paths like `design.footer.start.text`.
- `captionSettings(value).align` is `'start' | 'center' | 'end'`.
- The editor's exported lists (`HEADER_FOOTER_ZONES`, `CAPTION_ALIGNMENTS`, `IMAGE_EDGES`, design option enums, region layouts) use the new words.
- PPTX import returns the new words (`style.align: 'start'`, footer zones `start`/`end`, run `language`).
- Validation messages that list allowed values list the new words. An unknown key `left` on a slide or footer now gets the help `Write "start": layout words follow the deck's direction, so the sides are "start" and "end", not "left" and "right".` and the first suggestion `start`; an unknown `lang` on a run gets `Write "language": "lang" is not a field of this object.`

What did NOT change (leave these as `left`/`right`):
- ENGINE GEOMETRY words: a composed item's `alignment` (`item.alignment`, `fit.placement.alignment`, a furniture part's `alignment`, a composed caption's `alignment`, a table grid cell's `style.align` as returned by `tableGrid()`/`layoutTable()`) is still `'left' | 'center' | 'right'`; a composed placement's `edge` (`geometry.placements[].edge`, `ComposedOverlay.edge`) is still the PHYSICAL `'left' | 'right' | 'top' | 'bottom'`; logo `anchor`; arrow `direction`; box fields `.left`/`.right`; `physicalAlignment()`.
- PHYSICAL document words: chart `legend: 'left' | 'right'`, `dataLabels.position: 'left' | 'right'`, cell `borders.left/right`, `padding.left/right`, shape `padding`, image `focus`, image `callouts[].x`, crop, gradient angles.
- `shapes[].at.edge` already was `start`/`end`.
- Preset shape names (`leftArrow`, `rightBrace`), CSS, DrawingML (`algn="l"`), editor UI ids such as the region layout id `left-right`, test names and comments in plain English.

Other changes made in the same release that tests may hit (already migrated in most tests; fix the same way if you meet them):
- Objects are closed: an unknown key on `design`, `colorScheme`, `fontScheme`, `dimensions`, a background object, a header/footer, a text run, `audience`, `purpose`, `tone`, `organization`, `speaker` is a schema error (for example a `name` inside an inline `colorScheme`, or `footer: { text: '...' }` without a zone). Give the fixture the valid form.
- `shapes[].at.width/height` are fractions of the target (max 8); pixel sizes are `widthPx`/`heightPx`.
- Layout region arrangement `pyramid` with `pyramidDirection: 'down'` is `arrangement: 'inverted-pyramid'`.

## How to work

1. An automated regex pass already rewrote the unambiguous patterns in every test file. What is left are cases it could not decide: values passed through variables (`for (const side of ['left', 'right'])`, `chartPrimary: side`), keys whose value is a variable (`left: payload`), expected arrays of words, test helper tables, and a few places where the regex changed an ENGINE GEOMETRY word that should have stayed (revert those: for example an expected `tableGrid()` cell `style: { align: 'right' }` or an expected composed `alignment`).
2. For each file in your list: run it, read the first failure, open the test, decide whether the value is document vocabulary (rename) or engine geometry / physical (keep), fix, re-run. Repeat until the file passes or you hit something the vocabulary does not explain.
3. Think about right-to-left cases: a test that composes an RTL deck and expects the `left` region at the right now writes the region as `start`; the expected geometry is unchanged.
4. Keep edits minimal; keep the file's formatting. Do not rename test titles or variables unless they are the document word itself.

## Report back (concise)

- Files fixed (one line each: what kind of leftover it was).
- Files NOT fixed, each with: the failing assertion (expected vs actual), what you found, and whether you believe it is a source bug, a pre-existing failure, or needs a decision. Do not guess; say what you verified.
- Any place where you reverted an automated edit, and why.
