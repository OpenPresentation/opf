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

## Pending final source and production facts

This closeout preparation is **not RR-87 completion**. Pending fields below must
be replaced only with actual supervisor-accepted evidence; no placeholder is an
asserted future success.

| Gate | Actual accepted fact still required |
| --- | --- |
| Final plan source | PENDING: normal Core #707 source CI/queue and actual merged commit/tree. |
| Main source and production | PENDING: actual merged source/tree, postmerge BuildID/artifact seal, Worker version/deployment, 100% traffic and focused live acceptance. |
| Gallery source and production | PENDING: actual merged source/tree, postmerge BuildID/artifact seal, Worker version/deployment, 100% traffic and the agreed live journeys plus manifest/canonical asset verification. |
| Dev source and production | PENDING: final accepted source, normal workflow result, intended backend/Worker binding, actual activation/deployment identities and scoped live acceptance; unrun authenticated/model checks remain explicit. |
| Complete final census | PENDING: a separately assigned complete eight-repository census with its UTC timestamp, PR/draft/issue counts and reviewed dispositions. Earlier dated counts remain historical. |
| Safe primary synchronization | PENDING: separately authorized synchronization receipt with UTC timestamp and actual clean primary refs; no destructive cleanup is inferred. |
| RR-87 scoped closeout | PENDING: supervisor acceptance of the unchanged criterion, all final actual facts and the reviewed closeout source transaction. The broader program is not thereby complete. |

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
