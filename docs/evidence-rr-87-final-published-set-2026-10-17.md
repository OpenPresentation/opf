# RR-87 published artifact identities — 2026-10-17

The five selected packages are published from merged release-preparation commits.
The maintained trusted-publishing verifier passed package version, immutable tag,
`gitHead`, main ancestry, version at tag, SLSA subject/source/workflow identity,
npm signatures and own-package attestation, GitHub release and `latest` checks.
This is artifact verification, not completion of consumer, site or native acceptance.

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

## Remaining boundaries

The final canonical five-package registry consumer, showcase and Gallery vendor
producers, site qualification and deployments are separate acceptance steps.
No native support is expanded here: Windows Office remains on human HOLD,
supervisor-only native work stays separate, and RR-86 drafts do not inherit the
frozen historical native qualification. The original program criteria and earlier
[RR-85 evidence](evidence/rr-85-final-published-set-2026-10-16/README.md) are unchanged.
