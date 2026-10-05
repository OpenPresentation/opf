---
type: fixed
---
RR-20 (install fix, no API or output change): `engines.node` is now the open-ended `>=22` instead of `24.x`. npm's install picker skips a version whose `engines.node` does not match the running Node and silently installs the newest one that does, so on Node 26 (current) or Node 22 `npm i @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx` installed the 0.7.0 packages with core 0.9.0 instead of the latest release. The unit suite and the published-dependency check pass on Node 22, 24 and 26, and CI runs them on Node 22 and 26 (job `node-range`) next to the Node 24 package job; browser, golden and native gates stay on Node 24.
