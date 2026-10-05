---
type: fixed
packages: []
---
RR-51 (repository tooling; no package change): `scripts/release-train.mjs` waits for npm to propagate a fresh publish. Right after a publish the attestation bundle answers HTTP 404 and a scratch `npm install` of the version fails with `notarget` for a few minutes, which failed `verify` (core 0.12.1). `tag` and `run` now retry only those two checks every 30 s for up to 15 min (`--attest-wait-minutes`, `--attest-poll-seconds`); a bundle that is present but wrong, an invalid signature or any other install error still fails at once. Standalone `verify` fails fast by default and gains `--wait <minutes>`. Runbook: `docs/release-process.md`, "Release train".
