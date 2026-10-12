---
type: changed
---
RR-78 (OPF 0.19): gallery records are owned by `@openpresentation/gallery`; hosts register its `gallery` export for PPTX export instead of the removed core `/catalog` entry. Import uses the installed gallery only for foreign-layout mapping when catalogs are omitted; explicit `[]` opts out, while theme and colour recovery still requires explicit catalog registration.
