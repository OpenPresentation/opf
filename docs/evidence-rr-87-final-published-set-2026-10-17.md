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

The review spans all eight program repositories, including Core and its CLI and
the independent Gallery package. The accepted scope reconciles to **78 static
review areas** plus three cross-site checklists, five documentation tasks and
three later user features: **89 campaign entries**. The original planning count
of 81 included the three checklists; it was not 81 distinct authored-code areas.

Authored full reads remain distinct from generator/input/output checks,
dependency/vendor boundaries and sampled history. In particular, 76 current
Gallery articles received risk-based sampling and eight historical design
prototypes were sampled; neither is called a full authored read. The original
107 dispositions include aliases, observations, withdrawals and follow-ups as
well as confirmed defects. Private-site code and findings remain in the
supervisor's private ledger, outside this public repository note.

The complete consumer installed all five exact selected registry artifacts with
one Core instance and no local runtime overrides. Its maintained checks passed,
including twelve executed installed-code browser cases and sixteen CLI
regressions. The canvas and styled-table browser harnesses that were only built
are not described as executed. The shared showcase and Gallery vendor producers
then passed on that same installation, with the actual verified Editor
publisher's sixteen-file host closure. Gallery's catalog records and twenty-eight
canonical SVGs retain their existing identities.

Main has accepted local compiled qualification of 61 maintained cases. Gallery
has 634 passing unit cases, typecheck and all 25 approved compiled witnesses.
Gallery's initial file selection accidentally expanded to 76 cases and was
stopped after sixteen passes (four intended and twelve extra); only the
remaining twenty-one intended cases then ran. Initial setup/selection failures,
traces and original build identities are retained. These are local qualification
facts, not production deployment or native acceptance.

## Accepted delivery and pending source integration

This checkpoint is **not RR-87 completion**. The delivery facts below are
supervisor-accepted; the remaining source checks and normal merges are still
required. Candidate production acceptance does not waive them.

| Gate | Accepted fact and remaining boundary |
| --- | --- |
| Final plan source | [Core #707](https://github.com/OpenPresentation/opf/pull/707) actually merged as `c9677634c6f68869936b6cb8cd63d20841d32ecd`, tree `5c20dae564003c49edf638d35587e7d2431ccbbf`, after normal required CI/queue. The seven-file patch and full tree equal the reviewed immutable `0d36559d` docs/plan commit. Core's npm publisher remains `0e689585`. |
| Main source and production | Reviewed candidate `9a571e05`, BuildID `VQswjb0YnKAHOWBu3udJ5`, is accepted at 100% traffic (Worker `429f08ed-aad7-4c2d-8eda-c517da334afd`, deployment `10db1809-86f2-4659-a335-0a15ad2ab858`, 2026-10-17 11:12:02 UTC). All 15 maintained live cases passed with zero retries. Required source CI and the normal source merge remain PENDING. |
| Gallery source and production | The reviewed sealed candidate is deployed at 100% traffic (BuildID `cId4t7TnGYPA3YOFrkbkM`, Worker `83a52957-7649-43e3-b749-b8df3d149273`, deployment `cf2577eb-db22-493e-a747-8b7dcff2fed5`, 2026-10-17 11:10:35 UTC). All 11 focused live journeys passed with zero retries, including 44 manifest-pinned vendor files and 28 canonical layouts/records/SVGs. The original precommit build is byte-equivalent to the reviewed candidate; no rebuild or postmerge relabeling occurred. Required source CI and the actual source merge remain PENDING; manual production acceptance does not satisfy them. |
| Dev source and production | Current reviewed source `08a6e194` retains the actual `4209ede5` build and BuildID `z_XMRwCPqKyCFeqaProWh`, with only the accepted nonproduct delta. One backend activation and a no-reactivation resume verified two registered contracts immediately before the matching upload. Worker `ca33d210-aa91-4872-9242-07dbba6ac5da`, deployment `1ad6eba9-3833-4ac6-8887-8934e67fe7cd`, is accepted at 100% traffic (2026-10-17 11:21:29 UTC); three maintained live cases and nine bounded public checks passed. The backend-to-Worker gap was 219.279708 seconds, not atomic. Source CI/normal merge, signed-in/model checks and end-to-end delivery acceptance remain separate and PENDING. |
| Latest complete census | 2026-10-17 11:15:57 UTC: 11 open PRs, seven drafts and 45 issues across all eight repositories. One metadata-only request, all pages complete; no CI fields or issue bodies reread. Every current head and retained issue decision is reconciled; no new unreviewed item was found. Earlier dated counts remain historical. |
| Safe primary synchronization | 2026-10-17 11:16:50 UTC: all eight primaries are clean on expected default branches and match the fresh metadata. Four remaining primaries received one normal fetch and fast-forward-only update each; Core advanced to `c9677634`, the three site defaults remained unchanged. Four stable package defaults were unchanged, so they were not fetched again. No reset, stash, branch switch, pruning or destructive cleanup. |
| RR-87 scoped closeout | PENDING: required hosted source checks and normal integration of the three site PRs remain blocked by actual pre-scheduling billing failures. Manual production acceptance is not a CI waiver or source-merge result. The supervisor has not marked the unchanged RR-87 criterion complete, and no closeout PR is open. The broader program remains active. |

## Residual limits

The Gallery editor still reports real baseline Roboto style approximations:
800 draws as 700, 500 as 400, and 600 as 700. All seven pinned Roboto faces are
present, but the bare-family lazy selection exposes upright 400/700 while the
intermediate weights have separate legacy family names. Font manifest bytes and
this selection behavior are unchanged from the prior baseline. These warnings
are not suppressed; readable screenshots, zero JavaScript errors and passing
browser cases are not exact font-fidelity certificates. A bounded follow-up is
prepared for separate review, without changing this release train or claiming
new native results.

No native support is expanded here. Windows Office remains on human HOLD;
five genuine Windows repository controls do not certify Office. Mac native work
remains supervisor-only and incomplete. RR-86 drafts do not inherit frozen
historical qualification, and the dated published-P3 refusal remains attributed
to P3; this note makes no new P4 native17 claim. Physical OS IME, per-route/font
and unsupported renderer boundaries remain explicit. Site-specific accepted
follow-ups stay in the owner's private ledger.

The original program criteria and earlier
[RR-85 evidence](evidence/rr-85-final-published-set-2026-10-16/README.md) are
unchanged. This dated root document remains repo-only under the existing source
export filter; it adds no site progress page, status API or machine-resource
status surface.
