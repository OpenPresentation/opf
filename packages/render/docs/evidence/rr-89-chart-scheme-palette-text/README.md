# RR-89, RR-90, RR-92 evidence: chart series colours, text size and value axis

Each PNG is `main` (left, published core 0.20.5) against this branch (right, core with opf#708 + #716 RR-89, opf#710 RR-92, opf#718 chart.colors and the
RR-90 chart text size patch), rendered by `toSvg` + `toPng` at scale 0.75 from the two decks beside them.

- `default-2`, `default-5`: a deck without a colour scheme of its own. Chart text goes from 12 pt to 15 pt (14 px floored
  to 16 px, now 20 px). The series colours are core's `chartSeriesPalette` of the default scheme.
- `scheme-1`, `scheme-4`: the same charts on a `forest` colour scheme (`accent1` amber, `accent3` teal). Before, every
  deck drew the cool-horizon blues; now the series follow the scheme.
- The value axis is core's composed axis. In these charts it equals the axis the preview drew before (0 to 900 in steps
  of 100, 0 to 1800 in steps of 200).
