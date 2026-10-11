# PPTX 0.18.1 published and independently verified

Release prep [245](https://github.com/OpenPresentation/opf-pptx/pull/245) merged at `95a2f22fc2ecbef2c359649ea4b308c649923fb4`, tree-identical to the reviewed preparation. All four exact-commit checks passed with the prescribed gate confirmation, including Windows.

The release tool created `opf-pptx-v0.18.1`; trusted [workflow38121535830](https://github.com/OpenPresentation/opf-pptx/actions/runs/38121535830) published it. The tool waited for registry and attestation propagation, then exited0. A separate supervisor `release-train.mjs verify @openpresentation/opf-pptx@0.18.1` also exited0; its [complete output](independent-verify.log) records integrity, tag/gitHead/main equality, exact version, SLSA workflow/ref/commit provenance,13 valid npm signatures with package attestation and the GitHub Release.

This closes T10. Editor/CLI publication, held patch releases, final0.19 and site adoption remain separate gates.
