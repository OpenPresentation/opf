---
type: fixed
packages: []
---
RR-98: the gallery editor vendoring (`prepare:gallery:registry`) copies every stylesheet and script the editor playground page links, including the editor package's own `styles.css`, records them in the manifest and the cache-busting revision, and fails the build when a linked file is missing, so pptx.gallery's `/opf-editor/styles.css` no longer 404s after a re-vendor.
