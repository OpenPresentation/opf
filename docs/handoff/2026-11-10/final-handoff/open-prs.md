# All open pull requests at handoff

Initial census: 60 PRs; four takeover drafts added, giving **64 open PRs: OPF53 / Org4 / Gallery3 / DEV4**. All original open heads are preserved. This table records the inventory snapshot and declared resume actions; re-read current GitHub state before acting. The canonical integration is being normally aligned for this handoff; its final full head is recorded in the coordinator closeout, not inferred from the earlier e5de snapshot. No PR is merged by this document.

## Public OPF PRs

See [all49 original public PRs and exact heads](opf-pr-handoff.md) and [full source/ancestry JSON](opf-pr-handoff.json). The initial41 ancestor heads consist of38folded sources, two retained historical evidence heads and the old umbrella head. Six dependency proposals and two standalone evidence heads are outside that ancestry. Evidence status is independent of ancestry.

| New draft | Stream | Exact head | Next gate |
| --- | --- | --- | --- |
| [#1267](https://github.com/OpenPresentation/opf/pull/1267) | W03 native Latin font slots | a72850e125493da4d88b3e93ef236665d58bc0b4 | Known14/15 focused RED; resolve native-body canonicalization contract, run strict/full checks and actual Save qualification |
| [#1268](https://github.com/OpenPresentation/opf/pull/1268) | W08 viewer/connector | 1644f461e796dd37fa68a2f6e8e54e32724c1ddd | Review kit; metadata/browser/client and genuine0.34 adoption remain owed |
| [#1269](https://github.com/OpenPresentation/opf/pull/1269) | W05 schema review — NEVERMERGE | 5b7c64225e2100539deacb270cb266b68820b116 | Owner proposal review before any implementation adoption; literal migration is unsafe |
| [#1270](https://github.com/OpenPresentation/opf/pull/1270) | W04 native font preparation | b964ab9ab42a89bac2627ac5461c665b1e4dbf86 | Documentation only; implement and qualify incremental native dependency preparation |

## Private site PRs

Detailed private titles/branches/full heads and recovery metadata are kept in each private repository on codex/handoff-recovery-20261110 and in the owner's takeover prompt. These are links and scope labels only; no private source or response bodies are copied into public OPF.

| Repository / PR | Draft | Stream | Resume action |
| --- | --- | --- | --- |
| [Data-Advantage/openpresentation-site#216](https://github.com/Data-Advantage/openpresentation-site/pull/216) | yes | W11 G1/G2 | Static future source already exists; reconcile genuine0.34 interactive assets/preview |
| [Data-Advantage/openpresentation-site#213](https://github.com/Data-Advantage/openpresentation-site/pull/213) | no | W13 content/media | Exact R2 cut/poster availability holds merge; inspect source/destination |
| [Data-Advantage/openpresentation-site#212](https://github.com/Data-Advantage/openpresentation-site/pull/212) | no | W13 finance cut | Review independent content and durable media with213 |
| [Data-Advantage/openpresentation-site#211](https://github.com/Data-Advantage/openpresentation-site/pull/211) | no | W13 dependency | Review and qualify |
| [Data-Advantage/pptx-gallery#180](https://github.com/Data-Advantage/pptx-gallery/pull/180) | yes | W11 H2/H3 | Four additions already authored; reconcile after actual0.34 |
| [Data-Advantage/pptx-gallery#179](https://github.com/Data-Advantage/pptx-gallery/pull/179) | no | W13 dependency | Review and qualify |
| [Data-Advantage/pptx-gallery#171](https://github.com/Data-Advantage/pptx-gallery/pull/171) | yes | W11 H1 browsers | Review and qualify /icons and /shapes |
| [Data-Advantage/pptx-dev#206](https://github.com/Data-Advantage/pptx-dev/pull/206) | yes | W11 CF18 cleanup | Unmerged leftover config; retired Worker stays deleted |
| [Data-Advantage/pptx-dev#205](https://github.com/Data-Advantage/pptx-dev/pull/205) | no | W13 dependency | Review against master |
| [Data-Advantage/pptx-dev#204](https://github.com/Data-Advantage/pptx-dev/pull/204) | yes | W11 CF17 CI | Review/fold source; genuine hosted Preview remains owed |
| [Data-Advantage/pptx-dev#200](https://github.com/Data-Advantage/pptx-dev/pull/200) | no | W11 held0.33 adoption | Owner credential decision plus actual preview/auth/service/canonical gates |

## Disposition rules

- Keep38folded source leaves frozen. Do not make their branches look current by merging main into them again; their source is already in the integration history.
- Keep public evidence PRs1134/1136/1147/1151 and all evidence/recovery refs out of product merges. Do not delete provenance-bound producers.
- Review all nine newly enumerated dependency PRs and both private content PRs explicitly; do not silently ignore or automatically adopt them.
- DEV default is master; OPF/Org/Gallery use main.
- No PR draft/mergeability/old pass is acceptance. Use the maintained exact-head batched pr-gate for actual observation/merge.
