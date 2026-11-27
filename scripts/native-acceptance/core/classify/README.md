# Classify a native run (NT-04c)

Almost every slide looks a little different in a native application: Keynote has no Aptos and draws Helvetica, which is wider. So "differs from OPF's preview" cannot mean "new". A difference is **new** when nobody has looked at it yet. Two things carry a review forward:

1. **Known records** (`known/<target>.json`, NT-03). A record's `where` names a deck, variant and slide. A record with a `scope` and a feature that changes how every slide looks (fonts, text, languages) is *ambient*: today that is `kn-missing-fonts`.
2. **The baseline**: the committed summary of an earlier run (`runs/<opf version>/<target>.json`). For each file it holds every slide's score and class as they stood after review.

## The rule

Each slide is compared on `score`: the share of pixels that differ from OPF's preview (NT-04a, `core/compare/`). The checks run in this order:

1. **new**: a change names the slide (`options.look`, `--look deck#slide`, `--look-file`), whatever its score. This is how the `native: [deck#slide]` slides of unreleased changelog fragments (NT-07) reach the classifier. It covers what the score cannot see.
2. **not-compared**: there is no picture pair (a hidden slide, or the render did not run).
3. **same**: the score is at or below the threshold T. If a record names the slide, the slide is **known-gone** instead: the record's difference no longer shows there, and the record is listed in `knownGone`.
4. **new**, with a `direction` of `up` or `down`: the baseline reviewed the slide (same, known-present or known-gone, with a score) and the score moved by more than the tolerance. This applies even when a record names the slide, so a record never hides a change. A drop is usually a fix or an improvement; someone confirms it and retires or narrows the record.
5. **known-present**: an open record names the slide.
6. **known-present**: the baseline reviewed the slide and the score is within the tolerance. It was reviewed before and has not changed. The slide gets the baseline's record ids, or the ambient ids when the baseline had none.
7. **new**: anything else (not in the baseline, or left new there).

The rule also checks four things per file. Each one is known-present when a record or the baseline covers it, and new otherwise:

- `open` is not `done`. The baseline covers it if its open had the same status.
- An import-warning line. A record covers it if its `warning` has the same text, ignoring the `Slide(s):` and `Slide Layout(s):` lists. The baseline covers it if its `warnings` have the line.
- A failed `resave.import`. Only an open record whose `where` names the file and whose `importError` equals the importer's error code (the text before the first colon of `resave.import.error`, such as `invalid-chart-cache`) covers it, or a baseline whose import of the file failed with the same code.
- Object outcome counts (kind by outcome) that differ from the baseline's. These are compared only when the exported objects per kind (the outcome counts summed per kind) equal the baseline's. When the exported content changed, the file gets the note "content changed since the baseline; outcome counts not compared" instead of a finding.

How records are matched:

- Only `open` records count. A retired difference that shows again is new.
- A `where` entry without a variant means the default export, as `known.schema.json` says. The 0.36.0 round shows why it cannot mean every variant. `kn-slide-number-beside-footer-text` names `footers` and `layouts-ordinary` without a variant, and their `static` exports (static slide numbers) were graded same or font-only there.
- The qualification corpus names `--body-text native` as `native-body`. The records and the round's decks call it `native`. `VARIANT_ALIASES` treats the two names as one export.

`CALIBRATION` in `classify.mjs` holds T and the tolerance (see Calibration below).

## Files

- `classify.mjs`: the rule. `classifyResults` works in memory. `classifyRun({ runDir, known, baseline, options })` writes `<run>/classify.json`, which is checked against `native-classify.schema.json`.
- `classify-run.mjs` is the command: `--run <dir> --known <file> [--baseline <summary.json>] [--sheets] [--known-before <opf version>] [--look deck#slide,...] [--look-file <json>]`. A look file holds an array of `"deck#slide"` or `{ deck, slide, reason }`; a named slide is new in every variant of the deck.
  - It prints the counts and every new slide and finding.
  - `--sheets` writes a labeled sheet for each new slide into `<run>/sheets/`.
  - It exits with 0 when nothing is new, 1 when something is new, and 2 when the run directory is unusable: missing or invalid, a refused run, or nothing compared yet.
- `summary.mjs`: `summarize`, `formatSummary`, `writeSummary`, `readBaseline`. The summary format is `native-summary.schema.json`, with one line per file:
  - `classes` has one letter per slide: `s` same, `k` known-present, `g` known-gone, `n` new, `-` not-compared.
  - `scores` are rounded to 5 places.
  - `known` maps a slide number to its record ids.
  - `outcomes` counts the file's objects as `<kind>.<outcome>`; summed per kind they are the exported objects.
  - `import` and, when it failed, `importError` (the importer's error code).
  - `export` (NT-13): `{ deck, slides }`, the export hashes of `core/select/slide-parts.mjs` (16 hex digits each). The next
    release candidate (`--tier candidate`) opens only the files whose hashes differ. `classify.json` carries the same field per
    file, and `changed: true` on a slide whose hash differs from a baseline that has hashes (every slide when the deck hash
    differs or the baseline lacks the file). It changes no class. Summaries without `export` (0.36.0) stay valid.
- `baseline-from-round.mjs`: a one-time importer that built `runs/0.36.0/keynote.json` from the 0.36.0 Keynote round's hand grades. Do not use it for later releases.

## When a slide is new

Open its sheet and decide:

- **The application reads a valid file differently.** Add a record to `known/<target>.json` (or add the slide to an existing record's `where`) with `whose`, `grade`, `firstSeen` and, when there is one, the issue. Run `pnpm build:native-known` if the record belongs in the skill table.
- **OPF's file, importer or preview is wrong.** Fix it, or open an issue and record it the same way until the fix lands. Decision D1 (a Keynote pass gates OPF defects only) is applied by the record's `whose`, not by this code.
- **An intended change** (the preview changed with it), or a fix (`direction: down`). Nothing needs recording for an intended change; for a fix, retire or narrow the record. The next baseline carries the slide as reviewed.
- **A failed import.** Record it with `importError` set to the importer's code.

Then classify again. A run is clean when it exits with 0.

## The next release's baseline

After the release run has been reviewed and exits with 0 against the current known records and the previous baseline, write its summary to `runs/<new version>/<target>.json` with `summarize` and `writeSummary`. NT-05's `pnpm native --write-summary` does this. Commit only that file. The run directory, pictures and sheets are evidence and stay out of `main`.

## Calibration (0.36.0 Keynote round, Keynote 16.0, macOS 26.6.2)

- **Threshold T = 0.005.** These are the scores of the 1,286 graded slides (3 hidden slides have no score):

  | grade | slides | lowest | median | highest |
  | --- | --- | --- | --- | --- |
  | same | 75 | 0.0089 | 0.015 | 0.071 |
  | small | 1,108 | 0.0051 | 0.042 | 0.244 |
  | wrong | 100 | 0.0077 | 0.074 | 0.465 |

  - The grades overlap at every value above 0.005. Even graders' "same" slides carry the Helvetica substitution.
  - T is the largest round value with no graded small or wrong slide at or below it. The lowest such slides are six SmartArt fallback pictures at 0.0051 to 0.0079, and a footer hidden behind a picture (wrong) at 0.0077.
  - A higher T would call graded differences same and report their records as gone. With T = 0.005, a Keynote slide is almost never "same" on its score alone, and the baseline carries the review.
- **Tolerance = 0.002.** The round opened 692 slides a second time (`warnings-rerun`: layouts, languages, matrix). Keynote drew byte-identical pictures and identical scores, so the run-to-run noise is 0.
  - 0.002 is the band NT-04a accepted between two implementations of the score on the same pictures. It is kept as headroom for another Mac's color conversion.
  - At 1280 × 720 it is about 1,800 pixels, roughly one short word.

## What the rule cannot see

Replaying the 0.35.1 matrix run as the baseline of the 0.36.0 matrix decks showed these limits:

- **Small shifts inside text that already differs.** MX-01 moves wrapped lines by one space. Keynote's substituted Helvetica has already moved every glyph on those slides, so the score of m-text-flush 1, 3, 4 and 6 stayed the same to 0.0001. Only a change that names the slides (`--look`) brings them up.
- **Scores that move within the tolerance.** MX-03 on m-charts 3 moved by 0.0007.
- **Anything on a slide no picture shows**: a hidden slide, alt text, tags, names.

So `new` means "look here". It never means that every other slide is unchanged.
