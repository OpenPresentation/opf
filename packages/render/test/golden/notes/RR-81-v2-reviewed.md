# RR-81: reviewed v2 example and template baselines

The reviewed source graph is renderer `8c651e66ca995e790e0fd42d9822b34c4578be29`, core `37d96a28aeba2be28a9d4bde5f1aca73264c1a03`, and gallery `e0a7eee2dfe996e680b34a907cabfe41905e6d99`.

The supervisor reviewed all 171 changed example slides and 26 template image-fit changes. The examples migrate to v2 layouts. The final 20 vertical Evidence Packs use chart-beside composition to preserve readable charts, quotes and metrics; the 20 horizontal Evidence Packs remain unchanged. Authored content, order and design are preserved. The template changes affect 65 SVG image elements, using contain instead of cover; the other SVG trees are identical. No unexplained drift is accepted.

Pinned dry runs [renderer 38116271551](https://github.com/OpenPresentation/opf-render/actions/runs/38116271551) and [core 38115772021](https://github.com/OpenPresentation/opf/actions/runs/38115772021) reproduced unchanged main and the reviewed 807 example and 498 template records. Their shared gates passed with confirmation. Every downloaded changed PNG matched its recorded SHA256 and byte length.

The prescribed renderer [promotion 38118061331](https://github.com/OpenPresentation/opf-render/actions/runs/38118061331), using reviewed tooling `a224c61c0b8f2824665294e7c1d738b6f9db3f24`, wrote commit `ab23a258b1199dc3ac8b700411eb952550a00ef8`. Core [promotion 38118051360](https://github.com/OpenPresentation/opf/actions/runs/38118051360) wrote `91a1c96df7b4bddf7144c71ea079220765b9360b`. The supervisor independently fetched and inspected both commits: all 127 renderer deck files reconstruct the exact reviewed 807 entries, and the template baseline and core fixture are byte-identical to the dry-run candidates. Only the intended generated artifacts and core fixture selection changed. No local hashes were copied into baselines.

Candidate file digests are `8a19f5152853388583726b6df23d44071e73e481570fd237f0081ea43be6d0b0` for examples and `cd84208d7faa1d321842fe14e5de8edcd385b415ad88b0dd31b98f29f2a6a759` for templates. Detailed evidence is in OpenPresentation/opf `docs/evidence/rr81-final-v2-supervisor-review`.

This review accepts the exact promoted visual outputs. Terminal promotion-workflow confirmation, normal CI baseline selection, native PowerPoint acceptance, published gallery2 installation and final integrated release gates remain separate; this note does not assert those outcomes.
