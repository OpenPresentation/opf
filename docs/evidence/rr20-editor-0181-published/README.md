# Editor 0.18.1 publication verification

The supervisor's trusted release tool and separate independent verification both completed with exit 0. Release commit/tag/gitHead/main identity: `7831a15b10b9b3e1120ed90789fc9429b1c4f846`, tag `opf-editor-v0.18.1`. [Trusted publication run 38129138355](https://github.com/OpenPresentation/opf-editor/actions/runs/38129138355) and [GitHub Release](https://github.com/OpenPresentation/opf-editor/releases/tag/opf-editor-v0.18.1).

Retained original logs: [publication](publication.log) and [independent verification](independent-verify.log). Both establish npm 0.18.1 integrity, exact tag/gitHead/main equality, SLSA trusted workflow provenance, and two verified npm signatures with zero invalid/missing signatures and a verified attestation. No fresh API query or publication was performed by this records change.

This closes only T11; progress is 12/40. CLI fresh dry preparation completed seven allowed metadata files and passed independent metadata review; full and packed gates are running after PR612 merged at `6eee0d598c3ea0a1e97871a4f966270daf687a42`; CLI is not published. PR608's source-neutral `e984` update has checks pending; PR611/613 remain queued. Native acceptance, final 0.19 integration, gallery2 adoption and site gates remain separate.
