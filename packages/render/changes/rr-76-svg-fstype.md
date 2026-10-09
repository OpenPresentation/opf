---
type: fixed
---
RR-76 (licensing): an SVG never embeds a face whose OS/2 fsType forbids it (opf-render#186). Since RR-61, a host's face with Restricted License embedding (0x0002) was written whole into every SVG whose text drew it. Now restricted and bitmap-only (0x0200) faces are left out of `@font-face`. The SVG still names the family, so a viewer without the font draws the generic family, and one `font-embedding-restricted` diagnostic per slide lists the faces left out. Installable, preview & print (0x0004), editable (0x0008) and no-subsetting (0x0100, embedded whole) faces are embedded as before. The fsType is read from the data URL's table directory, without decoding the face. Bundled faces all allow embedding, so only host-supplied faces are affected.
