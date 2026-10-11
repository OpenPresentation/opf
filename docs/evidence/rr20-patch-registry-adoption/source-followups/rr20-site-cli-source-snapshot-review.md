# Local CLI source snapshot correction

New isolated checkout `/private/tmp/openpresentation-site-cli-source-snapshot`, based on reviewed 104 `506a38bd8a3b6a86065199c74c09069581aa67a2`; source qualification proof27c remains untouched.

Diagnosis: remote sync obtains the entire exact selected git source checkout, so packages/cli/src is retained there. Prescribed OPF_LOCAL_SOURCE mode has a selective copy list containing CLI README but not CLI src. The snippet validator tests .opf-source/packages/cli/src and otherwise skips command/flag checks with a warning. Therefore local qualification is incomplete despite its final 27-case summary.

Three-path correction: add packages/cli/src to local-mode copy list; add a real isolated child-process regression in scripts/sync-opf-content.test.mjs; register it beside the existing Node font preparation tests in package.json's ordinary test command. Dependency/version/lock entries and remote ref resolution/version verification/reuse behavior are unchanged. No generated resources are committed.

The regression invokes the actual local sync against a scratch source/site, verifies exact top-level and nested CLI bytes in the private .opf-source validation snapshot, and asserts CLI source is not publicly exported as agent documentation. The actual focused test and both registered Node test files pass (5/5). Logs /private/tmp/rr20-site-cli-source-sync-test.log and /private/tmp/rr20-site-cli-source-sync-registered-tests.log. Full ordinary site regression remains independently blocked by committed old starter pins against candidate core; this change does not waive that failure. No new production build is needed for this snapshot-only logic correction. No push, deployment, registry metadata or shared candidate mutation occurred.
