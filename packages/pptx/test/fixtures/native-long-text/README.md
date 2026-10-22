# Retained original long-text presentation

`llmreference.pptx` is the exact seven-slide file supplied by the owner as
`Downloads/llmreference.pptx`: 97,474 bytes, SHA-256
`a16ba26a8e6822c30b96b47e4d929ed805af0653fcccf9d4682ff7edf08cc29a`.
Keep these bytes immutable. Do not regenerate the deck, change fonts, trim spaces,
or save a native application's changes over this tracked source. Its original OPF
and generation dependency versions have not been established from the artifact.
The fixture contains no embedded font programs.

`manifest.json` records source facts from the original OOXML for slides 3 and 5:
exact text, separate line shapes, significant trailing spaces, Latin font names,
point sizes, `wrap="none"` and allocation boxes in EMU. Slide 3's first item ends
its first shape with `per-minute for ` and continues with `audio models)` in the
next shape. Slide 5's body ends its first shape with `each deploy to ` and places
`Vercel.` in the next. Titles name Aptos Display; body shapes name Aptos.
Allocation boxes are within the slide, which does not prove glyph containment,
font availability or visual fidelity in a native application.

## Portable integrity check

After the repository's normal dependency setup, from its root:

```sh
node test/native-long-text-fixture.mjs
```

The ordinary package test discovery includes this file. It does not build or
export another presentation, open Office, install fonts, or certify native fit.

## Native UI review from the reviewed Git revision

1. Check out the same reviewed immutable Git commit on each host. Run the
   integrity check above. Distribute the case through Git; do not transfer a
   separately regenerated presentation or a temporary test ZIP between hosts.
2. Copy the tracked `test/fixtures/native-long-text/llmreference.pptx` into a new
   local attempt directory outside the checkout. Record the Git commit and
   verify the copy's SHA-256 against the pinned value above before opening it.
   Windows example: `Get-FileHash -Algorithm SHA256 -LiteralPath <copy-path>`;
   macOS: `shasum -a 256 <copy-path>`. Use a fresh attempt after any failure.
3. Open only this copy in Keynote on macOS or PowerPoint on Windows. Record the
   application and OS versions and any missing-font or substitution dialog before
   dismissing it. For the unchanged baseline, do not replace fonts, install fonts,
   or save. An app-reported family name alone does not prove the physical font
   file used to draw every glyph.
4. Inspect slides 3 and 5 at a recorded zoom and capture each full slide plus the
   affected text at readable scale. Inspect both long first lines and their
   continuations against the manifest. Record whether glyphs leave their own
   allocation boxes or the slide; whether lines overlap or move; and whether the
   continuation text remains visible and separate. Record the actual observation
   and any uncertainty, not an assumed pass based on the source boxes.
5. Retain screenshots, font warnings, source hash, application/OS versions, Git
   commit and written observations in the attempt directory. Close only the
   presentation owned by this review without saving the original. Native results
   require supervisor review; this fixture and its portable test carry no native
   visual acceptance claim.

The maintained [`native-text.ps1`](../../native-text.ps1) worker accepts generated
one-slide Carlito cases and performs edits/save/reopen. The core
[`native-acceptance` suite](https://github.com/OpenPresentation/opf/tree/main/scripts/native-acceptance)
has its own generated, sealed case contracts and bounded supervisor workflow.
Neither runner accepts this unchanged seven-slide original as an existing case.
Use the UI workflow above for this fixture; do not rename it into a generated
case or bypass a runner's eligibility checks. Any automated native extension
requires its own reviewed scope; root owns Windows dispatch.
