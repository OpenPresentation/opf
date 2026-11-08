# First v0.34 example golden review

Evidence only. Never merge this branch. Source rendering commit 545067d7be36df86b82be9c38b324ddf1bb2e887; pinned workflow https://github.com/OpenPresentation/opf/actions/runs/42498350968; generated commit 348fd323b31302b5a3cdd7af2db8bb8bf6fffa2a.

The coordinator inspected all62 changed original320x180 example PNGs. Per-image notes and SHA-256s are in [review.json](../../evidence/golden034-example-review/review.json); source association uses the artifact index.html captions. The different diff.changedSlides ordering was rejected before recording judgments. Raw artifact PNGs and index are retained unchanged with a finite hash manifest.

This is not final release acceptance. Separate template review identified49 clean continuation fallback panels over the reading measure; SH-26 is under repair and needs another pinned golden pass. Arabic and Japanese images visibly lack glyphs in this no-explicit-fonts producer; they do not certify language/font readability. Actual font-enabled CLI/native evidence is separate.

A suspected French missing-reference defect at quarter scale was rejected: all seven raw/bundled API SVG hashes agree and regenerated quarter PNGs equal the workflow output; the full-size French image shows all five data values,92% line and2023 band. The original CLI report, SVGs, seven images, API log and full-size French witness are preserved under rejected-french-candidate. No product edit followed this false candidate.

The owner subsequently requested a proposal-first replacement of title-inferred reference lines with explicit document properties. That proposal is awaiting review; this evidence does not approve the old inference design or authorize its publication.
