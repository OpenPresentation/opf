# Native tab v2 run 04: offline quantization analysis

This analysis uses only the retained `native-tab-v2-04/report.json` observations and exact `ppt/slides/slide1.xml` bytes extracted from the saved PPTX. The portable bundle contains those two inputs rather than the full PPTX, PNGs, worker logs, or font data. It makes no Office, UI, or font call and does not modify the published evidence bundle.

## Bound inputs

- `inputs/native-tab-v2-04-report.json`: `dd2dc51ec6714c864479b93791eefe9807ab9f8c649f7a3c7bcabaca61b5a71c`
- `inputs/native-tab-v2-04-slide1.xml`: `b7bf2146362d7147d3b840d381dc339a3cf37f0cb51ea141909a9819dfe40117`

Both are derived from the merged core evidence at `docs/evidence/windows-native-tabs-fonts-20260921`, merged by core PR 106 at commit `3847f712ccb2379952bcc8ab7c9fdbaedfd0a4ce`. The raw report is an exact byte copy. The XML is an exact ZIP-member extraction from source PPTX SHA-256 `73f271c2e360ba47b00894ca577a3c12fc5ebb006aca4d8dacd907a1b2d0d6f1`; `provenance.json` records the source paths, hashes, ZIP member, size, and CRC.

The original and reopened values are exactly equal for every field examined in all nine pairs. The original and reopened phase metrics are also exactly equal.

## Pattern established by the nine pairs

Let `E = 12,700` DrawingML integer units per point, `B = 411,480` be the saved tab-shape x coordinate (`32.4` points), `t` be the requested tab coordinate, and `F32(q)` be the nearest IEEE-754 binary32 value to `q`, subsequently represented exactly as a binary64 JSON number.

For every pair in this run:

1. The saved tab-stop integer is `P = nearest_integer(t * E)`. The same nine integers result if `t` is first narrowed to binary32, so these cases do not distinguish those two possible input paths.
2. The saved literal-shape x coordinate is exactly `X = B + P`.
3. `ParagraphFormat`/`Ruler.TabStops.Item(1).Position` is exactly `F32(P / E)`.
4. The literal shape's observed `Left` is exactly `F32(X / E)`. The literal text character's `BoundLeft` equals that shape `Left` in all nine cases.
5. The tabbed `Before` character's absolute `BoundLeft` is compatible with `F32(32.4 + nearest_0.05(t))` in all nine cases. Its reported offset is the binary64 subtraction `F32(32.4 + nearest_0.05(t)) - F32(32.4)`. This produces only three offsets: `16.25`, `16.299999237060547`, and `77.29999542236328` points. Because the `32.4` point base is itself on the `0.05` point grid, `32.4 + nearest_0.05(t)` equals `nearest_0.05(32.4 + t)` for all nine rows. These data therefore cannot distinguish a pattern applied to relative tab distance from one applied to absolute text position.

The saved and COM-observed tab-stop coordinates therefore retain a much finer position than the three tabbed-character starts observed in these nine records. The directly positioned literal shapes and literal character bounds track the saved integer coordinate rather than the three-value tabbed-character pattern.

| Pair | Requested `t` | Saved tab integer | Exact saved tab points | COM tab stop | Literal observed offset | Tabbed-character observed offset |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 16.25 | 206375 | 65/4 | 16.25 | 16.25 | 16.25 |
| 1 | 16.26 | 206502 | 813/50 | 16.260000228881836 | 16.259998321533203 | 16.25 |
| 2 | 16.27 | 206629 | 1627/100 | 16.270000457763672 | 16.269996643066406 | 16.25 |
| 3 | 16.27734375 | 206722 | 103361/6350 | 16.27732276916504 | 16.277320861816406 | 16.299999237060547 |
| 4 | 16.28 | 206756 | 407/25 | 16.280000686645508 | 16.279998779296875 | 16.299999237060547 |
| 5 | 16.29 | 206883 | 1629/100 | 16.290000915527344 | 16.289997100830078 | 16.299999237060547 |
| 6 | 16.3 | 207010 | 163/10 | 16.299999237060547 | 16.299999237060547 | 16.299999237060547 |
| 7 | 16.31 | 207137 | 1631/100 | 16.309999465942383 | 16.30999755859375 | 16.299999237060547 |
| 8 | 77.3173828125 | 981931 | 981931/12700 | 77.31739807128906 | 77.31739807128906 | 77.29999542236328 |

Seven requested targets are exact points on the saved integer grid. Pair 3's saved coordinate differs from its requested coordinate by exactly `-17/812800` point (`-0.00002091535433070866`), and pair 8 differs by exactly `61/3251200` point (`+0.0000187623031496063`). Those package-coordinate differences are far smaller than the observed tabbed-character start differences.

The leading tab character's `BoundWidth` is not the following character's start offset: it exceeds that offset by exactly `0.005039215087890625` point in pairs 0–7 and `0.00504302978515625` point in pair 8. The analysis therefore treats `BoundLeft` of the following `Before` range as the start observation and does not substitute the leading range's width.

## Relation to the retained gate result

The exact binary64 arithmetic reproduces the retained metrics: maximum tab error `0.022655487060546875`, maximum literal error `0.00002288818359375`, and maximum pair delta `0.022678375244140625` point. The literal gate passes; the tab and pair-agreement gates fail at the retained `0.02` point tolerance. Pair 3 supplies all three maxima. Pair 4 also fails pair agreement because its exact binary64 delta is `0.020000457763671875`, although its tab error is within the tolerance.

This analysis changes no acceptance gate. Run 04 directly records and evaluates the native `0.02` **point** tab, literal, pair, and persistence gates. The broader native metric suite's separate `0.1` **point** character-bound tolerance remains unchanged and is not evaluated here. Renderer issue 24's separate `0.1` **reference-pixel** browser/native-width gate also remains unchanged and is not evaluated here. The units, harnesses, and acceptance scopes of those three gates are distinct.

## Limits

These are exact equalities across the nine retained pairs and an observed `0.05` point-compatible pattern, not a claim about an undocumented PowerPoint implementation or quantizer. The records do not locate the internal operation that produces the observed tabbed-character starts. The tested inputs cannot distinguish a relative-distance grid from an absolute-position grid because the base is on that grid, or rounding from the original requested number from rounding after binary32 narrowing because both predict the same saved integers. The retained font name and file hash do not establish physical per-glyph font identity. This analysis does not propose compensation or a different tolerance and does not extend the result to mixed font sizes, tables, other fonts, or other PowerPoint builds.

From this directory, run `python analyze.py --output <fresh-path>` to reproduce the analysis solely from bundled inputs without replacing retained output. The script refuses an existing output unless the caller explicitly supplies `--overwrite`. The output records every input number as its JSON value, binary64 hexadecimal value, and exact rational fraction, and asserts all eight nine-pair equalities above. Run `python verify.py` to check the complete manifest, raw-input provenance, analysis replay, gate interpretation, file types, and privacy inventory using only the Python standard library.
