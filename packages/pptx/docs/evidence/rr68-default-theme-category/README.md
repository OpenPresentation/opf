# Default PowerPoint theme category correction

The Windows read-only Home > Layout observation still showed `Office Theme` on the maintained `furniture-layouts` fixture exported with published PPTX 0.20.1, despite the master `p:cSld@name` being `pptx.gallery`. That reported native finding supersedes the earlier assumption that the master name alone selected the category. No native screenshot or Windows evidence branch is copied here.

The supported theme writer already sets the theme root and theme-family display names for authored themes. The candidate uses `pptx.gallery` only when no authored theme resolves. Notes themes copy that finished theme; application metadata enumerates its name. Explicit catalog and embedded themes, import recovery and the script-profile prefix convention remain intact.

[The archive comparison](archive-review.json) binds nine maintained fallback inputs and the standard `furniture-layouts` input against genuine published 0.20.1. Only theme1/theme2 name attributes and application theme-name entries change; every other member, chart, palette, font, layout label, relationship, slide/content payload and diagnostic is byte-identical. A named-theme control retains the entire archive byte-for-byte. Strict fallback SHA/size references change together; no tolerance or XML normalization is added to the exporter or guard.

This is candidate source/archive evidence. Native category success remains pending a separately authorized read-only check of a freshly generated maintained fixture. A normally packed source candidate and explicit package/source identities can be prepared with core's unchanged `native:prepare`; its provenance must retain `registryAcceptance:false`. No one-off deck or native harness transfer, full native rerun, publication or deployment is claimed.

## Additional RR-54 strict archive controls

The first ordinary full test correctly stopped on RR-54's separate fixed chart/table archive references; 44 later test files were unrun. [The exact-caller comparison](rr54-archive-review.json) reproduces all 21 genuine published 0.20.1 references, sizes and part counts before updating their current SHA/size expectations. The caller deliberately omits catalogs, matching the maintained test.

All 640 ZIP members retain their inventories. Only 63 theme/application name parts and three table provenance environment fields change. The unchanged `tableEnvironmentEvidence` hashes the theme and table-style XML: recomputing old and new hashes matches both records, and restoring only old theme bytes restores the old hash. Decoded OPF_DATA_V1 records are otherwise identical, and exact raw tag replacement confirms no hidden drift. All three existing native-slide digests reproduce unchanged on both lanes. No hashing policy, tag normalization, native guard, authored cell value or tolerance changes.
