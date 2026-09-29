Intos font files bundled by @openpresentation/opf-render

These sixteen TrueType files are the unmodified `fonts/` output of the Intos project, vendored byte for byte.

- Project: https://github.com/muglug/intos
- Pinned commit: fef9315c14da9e4b23b4c3cac8e718998d4e4736 (2026-09-08, "Slim down README")
- Version string in the font name tables: 1.000
- License: SIL Open Font License, Version 1.1 (`LICENSE.txt`, verbatim from the pinned commit). Neither the license file nor the font name tables declare a Reserved Font Name.
- The files were retrieved from the Git LFS store of that commit; each file's SHA-256 equals its LFS object id and is pinned in `src/font-manifest.js`.

Upstream copyright statements, as carried in each font's name table (the license file above still carries a template copyright line, so they are repeated here):

- Intos, Intos Display and Intos Narrow: "Copyright 2016-2024 The Inter Project Authors (https://github.com/rsms/inter). Intos modifications Copyright 2026 The Intos Project Authors (https://github.com/muglug/intos)."
- Intos Serif: "Copyright 2022 The Gelasio Project Authors (https://github.com/SorkinType/Gelasio). Intos Serif modifications Copyright 2026 The Intos Project Authors (https://github.com/muglug/intos)."

Provenance, from the upstream README and build scripts: the sans families are derived from Inter and the serif family from Gelasio. Their outlines are drawn from those sources. The project sets advance widths, kerning and vertical metrics to those of Microsoft Aptos so that text keeps its line breaks, and its Semibold build scripts also read local Aptos files to place marks such as the i and j dots and to size some glyphs; the Display and Narrow families replay the Aptos to Aptos Display and Aptos Narrow proportion changes on the Intos masters. No Aptos file is part of the repository or of these files. OPF compared the outlines of the bundled regular faces with the Aptos 2.01 faces and found none identical (0 of 975 shared nonempty glyphs in each sans regular face; the only identical glyphs in Intos Serif Regular are eight plain rectangles such as the hyphen and dashes). The family names are not trademarks of the font they stand in for.

OPF uses these faces only as preview replacements for Aptos, Aptos Display, Aptos Narrow and Aptos Serif. The exported PPTX keeps naming the family the author chose, and no Aptos file is bundled or embedded.
