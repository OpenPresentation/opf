# RR105 dense survey public CLI correction

PUBLIC-SAFE evidence-only branch. **NEVER MERGE.** This packet binds frozen controller `623e4dbc1c958132ae055b2c544e8f3b986fe85d` (draft source PR #1240), without advancing its HEAD or granting Office authorization.

The original public create at `bcfc13037` failed before envelope creation because its option grammar rejected the declared `--expected-manifest-sha256`; verify's declared envelope digest option was also rejected. The correction changes only that grammar. All original 19 controls remain a byte-exact prefix; three real child-CLI groups add positive, malformed/unknown option, and digest refusal coverage. The genuine local before failure, root create failure, 22/22 after pass, lint pass and all 32 child command receipts remain lossless.

One real public create → verify → Windows PowerShell **default-pure** flow passed against the original 339-file `fd13b772...` suite and immutable producer/runtime. The envelope digest is `bbdb04137845ec16b2bdfc0bee4acf6e6e9ace57075f67c8bd09ddcea99a5040`. The pure launcher completed in 7.648 seconds, with default 45-second worker timeout recorded, `runOfficeRequested:false`, `nativeAcceptance:false`, `registryAcceptance:false`, and no native output. This is not native observation, physical fidelity or release acceptance. Modeled child `observe` is separate from this actual default-pure flow.

Required `check:changed --base bcfc13037c860476cc61034e84d8cd1e94226253` is retained **RED**: 88.0 seconds, 7 passing checks, 3 sparse-input failures and typecheck skipped. Native tests passed 83/87, including all 22 dense controls; four failures require missing historical rr68/script-corpora inputs. Gallery tests passed 9/18 with missing historical evidence; text lacked `painting-Linux.json.gz`. No hydration, warning override, assertion change, retry or duplicate full PPTX suite was used.

An attempted documentation-link commit was rejected by automatic review because it would advance the frozen controller HEAD. The command never ran. The safer separate evidence branch preserves that rejection and keeps the envelope-bound controller stationary; the note creates no remaining work blocker.

`raw-files.json` retains 269 files / 1,764,208 raw bytes, including all terminal mapped step logs, original failures, source patch, pure runner and generated modeled harness artifacts. Synthetic harness PPTX files do not establish native execution. `source-proof.json` binds five source paths and 13 protected objects. The older controller packet remains immutable and producer-bound; this new packet does not weaken its historical verifier to accept a changed leaf.

Offline verification (no builds, generators, Office or network):

```text
node docs/handoff/2026-11-09/rr105-dense-survey-cli-public/verify.mjs <repository-with-source-Git-objects>
```

The controller stays at `C:/opf-work/n034-dense`, HEAD `623e4dbc`. Actual envelope: `C:/opf-work/n034-dense-public-pure02/execution-envelope.json`. Root exclusively reviews any future fresh-output `-RunOffice` execution, bounded to the unchanged 5–60 second worker policy. The intact-seven worker remains unimplemented pending its separate property-allowlist review; charts and release work are outside this correction.
