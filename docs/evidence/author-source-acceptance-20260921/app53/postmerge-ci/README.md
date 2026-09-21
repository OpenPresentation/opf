# App53 postmerge CI: failed Linux gate

[Application CI35633321018](https://github.com/Data-Advantage/pptx-dev/actions/runs/35633321018) ran once at accepted `e40c287b64fcbcfb85fb4a8a50641aea8e3e54a8`: Linux **28/29** browser cases, Windows **29/29**, and **627 unit tests** each. [Artifact CI35633321013](https://github.com/Data-Advantage/pptx-dev/actions/runs/35633321013) passed both platforms. Node24.20.0; no rerun.

The Linux security test passed the shared-load toast, then stopped before security assertions: a unique-canvas visibility locator found five default-deck overlays instead of the one-slide fixture. [Trace facts](linux-failure-facts.json) retain exact timings and private original paths/hashes. No security exploit or underlying scheduling cause is established by this failure alone. The separate [canonical29/29](../../canonical/REPORT.md) remains valid for its exact run and does not replace this failed gate.

[Release audit](release-audit.json), [job results](application-jobs-final.json), [case results](browser-results.json), [log excerpt](ci-excerpt.log), [artifact verification](artifact-download-checks.json) and the [original private report](original-private-report.txt) are copied unchanged. Raw traces, response payloads and ZIPs remain private at the recorded paths; the original manifest inventories that larger directory rather than claiming all files are copied here.

The successful Windows timing upload again retained only Author data; Inspector/pagehide is missing. [Timing summary](windows-timing-summary.json) records 89 resources, two navigation snapshots, two paints and eight long tasks. This does not explain Inspector readiness.
