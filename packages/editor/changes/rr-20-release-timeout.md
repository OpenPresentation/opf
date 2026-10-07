---
type: fixed
---
RR-20 (release workflow only): the npm publish job may run 45 minutes instead of 20. The tests before `npm publish` now take about 20 minutes, and the opf-editor 0.14.1 publish run was cancelled at the 20-minute limit, seconds before publishing.
