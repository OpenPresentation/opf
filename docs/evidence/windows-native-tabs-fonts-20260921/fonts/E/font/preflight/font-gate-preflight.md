# Gate E font evidence preflight

This is a read-only preflight. It made no Office or COM call, registered no font, changed no source, copied no font program, and created no PDF. The machine inventory and exact candidate records are in [`font-gate-preflight.json`](font-gate-preflight.json).

## Candidate decision

The current installed registry consumer contains 33 checked faces across Roboto, Roboto Mono, Carlito, Caladea, Arimo, Tinos, Cousine, and Gelasio. Every font-file hash and every OFL-1.1 license-file hash matches the pinned renderer manifest. `fontkit` decodes every face's OpenType `OS/2.fsType` as zero: no restricted, preview-only, no-subsetting, or bitmap-only bit is set. This permits installable embedding under the font metadata, although Gate E must neither embed fonts nor emit a PDF.

The read-only HKLM and HKCU Windows font registry probes found none of those eight families. A future PowerPoint gate therefore needs temporary private registration. The bounded choice is the four current Carlito 0.4.1 files only: regular, italic, bold, and bold italic. They give one complete style family with four exact hashes and one exact OFL license hash. The parent process should add those files with the same private flags used for removal, record each positive add result, and remove only its successful additions after the worker ends. This preflight did not perform that registration.

Aptos 4.40 is excluded. It is a restricted proprietary candidate, is absent from the open registry manifest, and has no reviewed redistributable license source in this inventory. Gate E must not copy, register, embed, or use its program bytes. The source fixture's existing `Aptos Display` and `Aptos` typeface names remain recorded as source facts only.

## Smallest bounded fixture

Use the current-registry `plain-control.pptx` at:

`C:/Users/micha/.codex/worktrees/fd3f/opf/artifacts/windows-resume-20260921/notes-order-registry-01/original/plain-control.pptx`

It is a 15,644-byte, one-slide 960×540 presentation with SHA-256 `4dd235c923eb346ee19ac7ee89a93cce9a355eec7355692259d81c541bb3556d`. It has only two editable text shapes, named `OPF heading slides.0.title line 0` and `OPF text slides.0.text line 0`, and no media. Its current-registry generation record binds Node 24.21.0, OPF 0.11.0, OPF PPTX 0.9.1, and OPF Render 0.9.0.

The future gate should first copy this file into a fresh owned directory and snapshot the external input, owned copy, verifier, process helper, font manifest, four Carlito faces, and license text. It should open only the owned copy. The input and snapshot hashes must still match after the owned presentation has closed.

## Proposed native edit

Overwrite both visible shapes in the owned copy so the edited and reopened full-slide image contains no intentionally selected Aptos text. Set the title to `Gate E - Carlito`, Carlito 30 point bold. Set the body to the exact single paragraph:

```text
Regular 18 | Bold 20 | Italic 22 | BoldItalic 24
```

Apply Carlito to the whole body, then apply four exact `Characters(start, length)` spans: regular at 18 points `(1,10)`, bold at 20 points `(14,7)`, italic at 22 points `(24,9)`, and bold italic at 24 points `(36,13)`. The separators retain the 18-point regular defaults. Read back exact text plus family, size, bold, italic, and `TextRange2` bounds for the whole shapes and each named span.

Capture an original full-slide PNG before mutation, an edited full-slide PNG before save, and a reopened full-slide PNG after read-only reopen. Record the owned PPTX hash. The report should retain actual edited and reopened observations before evaluating them. After both exact owned closes have succeeded, evaluate exact text/style persistence, a 0.02-point edited-versus-reopened bound tolerance, and exact edited/reopened PNG hash equality. A mismatch is evidence and must remain in the report; it must not interrupt the Office lifecycle.

Use the current fail-closed control pattern: fresh output, parent-owned 45-second deadline with a 60-second maximum, durable begin/success/error records for every COM read and write, no retry, stop Office work on the first COM or semantic failure, close only the exact owned path, reopen it read-only, and never call `Application.Quit`, kill Office, discard a presentation, change Office security, or perform COM cleanup after a failure.

## Mixed-size and tab boundary

The mixed 18/20/22/24-point paragraph verifies that a real native text edit and four requested style tuples survive save/reopen. It does not prove renderer reflow or physical font-file identity.

The font gate deliberately contains no U+0009 and creates no tab stop. The separate tab-control v2 owns the literal-whitespace and tab-position question with Calibri 13.5 and a 0.02-point gate. Historical native measurements retained leading-tab discrepancies as high as 0.0226745605469 points, and mixed-size table tab acceptance remains an open issue. Gate E must not convert either result into a Carlito substitution claim.

## Claim limit

PowerPoint's `TextRange2.Font.Name`, bold/italic flags, exact edited text, save/reopen properties, and stable full-slide PNGs establish native selection and persistence on the tested host. They do not prove that every glyph came from a particular TTF, rule out fallback or synthetic styling, establish browser/native pixel equality, or certify Carlito as an Aptos-compatible substitute. Without PDF font-name evidence, the Gate E report must state those limits directly.
