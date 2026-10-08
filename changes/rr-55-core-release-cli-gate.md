---
type: fixed
packages: [opf]
---
RR-55: 0.15.1 is the first published 0.15 release. The `opf-v0.15.0` tag was created, but its publish run failed before `npm publish` (the CLI tests through the published opf-render and opf-pptx run in the core publish workflow, and those siblings publish after core), so `@openpresentation/opf@0.15.0` was never on npm. A core release tag now skips only those CLI peer tests with a notice; the CLI's own release keeps the hard gate. 0.15.1 ships the same package as 0.15.0 would have.
