# LH-121 renderer status controls

Isolated branch codex/lh-121-renderer-status-controls starts from freshly fetched main9545016583ccfa151077cda4d51043ac6505a140 and normally fast-forwards to current integrationb8fdd1cb88273a4f9963c9c01b89fbf1d5d5cc1b. Worktree C:/opf-work/lh121-rstat. Source/tests in folded branches remain immutable.

## Reproduced cause and vetoable decision

CI run42615508499/job129154560607 failed renderer shard3/4 at timeline-status.mjs28: German done markers had cy383.9398632812499, compared with no-status cy402.1503124999999. The unchanged baseline test reproduces those exact values after a fresh offline install and renderer/dependency build. German now has generated status words Abgeschlossen/Aktuell/Geplant, so its additional text legitimately changes its own timeline layout. No runtime defect was found in this bounded case.

Vetoable LH121-RENDERER-STATUS-CONTROLS: use advertised Afrikaans (af), with explicit language-membership and helper-undefined preconditions, for the no-vocabulary byte invariant. Preserve all original non-trace circle attributes, including cy, and the full non-line SVG comparison. Extend the existing done/current/planned color, ring, outline, text emphasis, contrast and exact marker geometry assertions to German in both light and dark themes. Check literal German visible words, generated-label colors and no visible English status leakage. Canonical English trace IDs remain unchanged and are not treated as visible text.

This is a maintainer test repair only: no package runtime, schema, language vocabulary, generated tracker, raster golden, hash, tolerance, worker, native script or product output changes. The required check:changed command uses exactb8 as its base. The fragment deliberately names no package changelog.

## Evidence and remaining checks

Original CI log is already fetched once and retained losslessly:93545 UTF8 bytes/SHA25673dc2390f8a0b8c808409d080482550cdfe997f8e34bb09cd5348e9ec79b4ae1. Local raw output lives at C:/opf-work/lh121-rstat-logs-20261109-01. Node24.20.0/pnpm10.33.2, frozen offline dependencies and the maintained machine slot are used. The first repaired focused test passes. Final focused/mapped checks, source review and publication are pending at this snapshot. No API/network verifier, CI retry, Office, provider, deployment or release action is performed.
