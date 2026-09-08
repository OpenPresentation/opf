# Coordinated renderer baseline

`opf-examples-png.sha256.json` identifies the current core examples for coordinated renderer CI. The renderer standalone suite retains its baseline for published core 0.4.0. Both enforce exact corpus and raster hashes; this file is selected explicitly only for coordinated source checks.

Reviewed against renderer 87663fb on 2026-09-08: 126 decks / 805 slides. Compared with the published-example baseline, only `technical/asset-source-forms.opf.json#1` changes. Its truncated eight-byte PNG signature is replaced with a complete project-authored PNG; the newly visible image was inspected at individual-slide scale. The other 804 PNG hashes are unchanged. This does not establish complete visual or PowerPoint parity.

Regenerate a candidate with the renderer golden test and `OPF_EXAMPLES_DIR` pointing to this checkout's examples. Inspect the changed images and source before copying the candidate here. Never update a baseline automatically to bypass a failing check.
