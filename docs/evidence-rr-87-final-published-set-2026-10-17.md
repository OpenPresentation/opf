# RR-87 published artifact identities — 2026-10-17

The five selected packages are published from merged release-preparation commits.
The maintained trusted-publishing verifier passed package version, immutable tag,
`gitHead`, main ancestry, version at tag, SLSA subject/source/workflow identity,
npm signatures and own-package attestation, GitHub release and `latest` checks.
Artifact verification is separate from consumer, site and native acceptance; the
current completed and pending steps are recorded below.

| Package | Version | Publisher commit | Tag | Trusted workflow | Published (UTC) | Verified signatures |
| --- | --- | --- | --- | --- | --- | --- |
| Core | 0.20.5 | `0e689585a128d5cecef8fe9b3843f2ea85c43283` | `opf-v0.20.5` | [38994127532](https://github.com/OpenPresentation/opf/actions/runs/38994127532) | 02:28:03.381 | 2 |
| Renderer | 0.20.4 | `e179673ab1fd7ae01998cd24b524f4ac19ce8d49` | `opf-render-v0.20.4` | [39011612973](https://github.com/OpenPresentation/opf-render/actions/runs/39011612973) | 07:14:02.709 | 5 |
| PPTX | 0.20.4 | `f06c3c66498e8c2b7505efe3d987a66cc6521117` | `opf-pptx-v0.20.4` | [39016387102](https://github.com/OpenPresentation/opf-pptx/actions/runs/39016387102) | 08:25:20.139 | 14 |
| Editor | 0.20.4 | `dbb8106ee60cef589d50a6777bbcbea3c3983efc` | `opf-editor-v0.20.4` | [39021683255](https://github.com/OpenPresentation/opf-editor/actions/runs/39021683255) | 09:57:39.907 | 3 |
| CLI | 0.20.1 | `12f85750b79b2ebf60c22ea511605685f85fa004` | `cli-v0.20.1` | [39021791352](https://github.com/OpenPresentation/opf/actions/runs/39021791352) | 09:45:41.029 | 3 |

Each signature result has zero invalid and zero missing signatures, including a
verified own-package attestation. Gallery 3.0.0 remains the independently published
catalog authority; its existing artifact and record identities are unchanged.

PPTX's first post-publication verification and its first standalone retry failed
while the newly published canonical tarball returned 404. One later canonical
request returned HTTP 200 with the exact registry integrity, and the unchanged
full verifier then passed. No package was republished or tag moved. The failed
Renderer 0.20.3 tag remains immutable history; 0.20.4 is the selected artifact.

## Separate source authorities

`release-plan.json` records actual artifact publishers in `verificationRefs`.
Its Editor `exampleRefs` deliberately advances from historical `2ac0268` to the
verified 0.20.4 publisher: all sixteen Gallery-host example files and local import
edges match the reviewed source, including the stale delayed-import correction.
These host files are not part of the Editor npm package. Historical examples,
previews and native evidence retain their original source identities.

Sites adopting this plan must pin its reviewed immutable source commit for
documentation; the Core manifest at that commit still carries 0.20.5. That
docs/tooling commit is separate from Core's artifact publisher above. No new Core
runtime release is implied by updating the plan, matrix lock or guides.

## Review scope and accepted qualification

The review covers all eight program repositories, including Core and its CLI
and the independently released Gallery package. The accepted plans contain
**78 static review areas**. Three cross-site checklists, five documentation
tasks and three later user features bring the campaign to **89 entries**; the
original planning count of 81 included those three checklists.

Authored full reads remain distinct from generated/vendor identity checks and
sampled history. In particular, 76 current Gallery articles were risk-sampled
and eight historical design prototypes were sampled. The original 107
dispositions include aliases, observations, withdrawals and follow-ups, not
107 bugs. Private-site source and findings remain in the owner's private ledger.

The single complete consumer installed all five exact selected registry
artifacts with one Core instance and no local runtime overrides. Maintained
checks passed, including twelve installed-code browser cases and sixteen CLI
regressions. The canvas and styled-table browser harnesses that were only built
are not called executed. Both shared site producers passed on that installation,
with the verified Editor publisher's sixteen-file host closure. Gallery 3's
records and twenty-eight canonical SVGs retain their existing identities.

Accepted local compiled qualification includes Main's 61 maintained cases and
Gallery's 634 unit cases, typecheck and 25 approved compiled witnesses. The
Gallery selection interruption and its extra cases remain separately recorded;
only missing intended cases were subsequently run. Later focused fixes and
normal hosted checks retain their own exact source and results. Local, registry,
production and native claims are separate.

## Current source and delivery checkpoint

This is **not RR-87 completion**. Normal remaining source checks and integration,
actual automatic-channel outcomes and the supervisor's final unit acceptance
are still required. Earlier manual production acceptance does not waive them.

| Gate | Accepted fact and remaining boundary |
| --- | --- |
| Final plan source | [Core #707](https://github.com/OpenPresentation/opf/pull/707) merged as `c9677634c6f68869936b6cb8cd63d20841d32ecd`, tree `5c20dae564003c49edf638d35587e7d2431ccbbf`, after normal CI and queue gates. Its tree equals the reviewed immutable `0d36559d` documentation/plan source. Core's npm publisher remains `0e689585`. |
| Main | The reviewed work is normally integrated. The actual default-branch source and successful automatic production channel are accepted: 19 maintained production smoke cases passed, the provider's current version is at 100%, and the homepage and Playground return the new literal BuildID `Kh5CfREY4FU41Ui7Iln0c`. This source also preserves the existing default-branch blog work. The earlier manual `1gny` footer/four-case and `VQsw` fifteen-case generations remain historical; no output seal or source attestation is borrowed from them. |
| Gallery | The reviewed source is normally integrated and its earlier sealed candidate/manual production and eleven focused live journeys remain accepted. The automatic channel recorded a credential-gate skip, not a new upload. The later test-only verification correction is normally integrated as `67f78c3e`. No new production identity or successful current default verification is inferred. |
| Dev | The final reviewed source is normally integrated, including the bounded Windows fixture corrections. Exact-source Windows repository checks and the full suite passed with their recorded existing conditional skips; this does not certify Office. Actual default-commit checks and the config-gated automatic backend/Worker channel remain pending. Two Windows attempts passed foreground checks but exhausted the 20-minute job budget during cache cleanup; the Dev job-envelope correction is pending normal CI and integration. The earlier sealed manual generation, three live journeys and nine bounded public checks remain separate accepted evidence; no new activation or production identity is inferred. |
| Inventory and synchronization | The inventory snapshot used by this draft is dated 2026-10-17 11:15:57 UTC: eleven open PRs, seven drafts and 45 issues. Later source merges, test-only follow-ups and safe primary synchronizations are dated overlays, not refreshed global counts. Earlier body decisions, failures and source/build identities remain retained. |
| Scoped closeout | Still in progress: finish remaining normal source/default-commit and automatic-channel gates, bind all 89 agreed entries to the accepted evidence and dispositions, then complete the reviewed documentation PR through its normal gates. The broader release-readiness program remains active. |

## Portable pending checkpoint — 2026-10-17

This draft deliberately remains incomplete. Editor [#181](https://github.com/OpenPresentation/opf-editor/pull/181) contains the reviewed example-host persistence refusal correction and its real-canvas regression; normal integration is pending. The Editor 0.20.4 artifact is unchanged. Advancing Core's immutable example source authority and adopting that host in Gallery have **not** been performed. The separate job-envelope correction and remaining site/default-channel gates are also pending. Resume from the maintained handoff and actual accepted source facts; do not infer completion from this draft or rerun the entire qualification factory by default.

## Residual limits

The Gallery editor retains baseline Roboto weight approximations: 800 draws as
700, 500 as 400, and 600 as 700. These warnings are not suppressed. Readable
screenshots, no JavaScript errors and passing browser cases do not certify exact
font fidelity. The separately reviewed follow-up does not expand this release.

Native Office qualification remains incomplete. Windows use is authorized as
needed, with Windows tests routed to the designated repository chat and the
supervisor coordinating scheduling. Older approval holds and host-availability
observations remain dated history. Repository controls do not certify Office;
RR-86 drafts do not inherit frozen historical native qualification. The dated
published-P3 refusal stays attributed to P3, without a new P4 native17 claim.
Physical OS IME, per-route/font and unsupported renderer boundaries remain
explicit. Existing architecture and native follow-ups retain their separate
scopes; this review makes no blanket security, zero-loss or native certificate.

The original program criteria and earlier
[RR-85 evidence](evidence/rr-85-final-published-set-2026-10-16/README.md) are
unchanged. This dated root document remains repository-only under the existing
source export filter. It adds no site progress page, status API or machine-resource
status surface.
