---
type: added
packages: [cli]
---
RR-79 (OPF 0.19): `opf convert <deck> -i --migrate` rewrites a deck for the 0.19 layouts in place, and `opf convert <in> <out> --migrate` writes the migrated deck elsewhere: every slide that names a removed 0.18 layout id takes its replacement layout and design settings, embedded 0.18 layout records become templates, and the report lists the changes under `migration`. `-i` needs `--migrate` and takes no output.
