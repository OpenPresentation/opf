# Shaping across authored rich-text runs

The joint-source implementation measures and paints adjacent text with equal
effective typography as one shaping context. Splitting `AV` or `office` into
JSON runs no longer removes kerning or ligatures or changes line wrapping.
Color, decoration and hyperlink changes retain that context. Tabs, hard/soft
line boundaries, font family/physical face, weight, italic, effective size and
baseline changes separate contexts.

`RichTextLine.fragments` now contains either an existing single-run
`RichTextFragment` or a `RichTextShapingGroup`. The group owns its complete
text, accepted width/origin, font size and style. Its `sources` array retains
each original run's index, half-open run-relative UTF-16 range, text, resolved
style and original formatting object. Groups deliberately do not expose a
false `runIndex/start/end` spanning beyond the first run. Consumers must use
`fragment.sources ?? [fragment]` to enumerate source spans. This coordinated
geometry API change requires matching renderer, editor and PPTX updates; it
must not be published under an existing package version.

Core fitting, wrapping, tab positioning and outline placement use the complete
context. No independently measured prefix is treated as the accepted glyph
advance. The renderer likewise shapes the complete group once. Whole glyphs
retain their ink overhangs. A ligature crossing a color boundary shares the
glyph outline and uses same-run font/interpolated caret positions to divide
its colors. Those interpolation labels remain visible in caret metadata.
When a source style boundary falls inside one grapheme, the first source
span owns that grapheme's paint; original text and all style spans remain in
the document. This is an explicit paint policy, not normalization of source.

Equivalent adjacent paints/decorations are joined for both prepared paths and
native SVG text so arbitrary source boundaries cannot introduce decoration
seams. Native SVG may retain nested styled tspans and links. The editor walks
their text nodes when constructing DOM Ranges rather than treating character
offsets as element-child offsets. Prepared maps already use complete-run
source ranges. Pointer, selection, navigation, source-preserving typing and
undo retain the original document structure.

PPTX uses the group's source spans to emit original native formatting runs
inside each accepted body/list paragraph. Table export still retains authored
paragraphs and native wrapping. Grouping never turns an authored run boundary
into a hard paragraph break. The existing multi-size table-tab representation
question and native Office geometry acceptance remain separate.

Validation includes non-additive model measurements; exact source ranges and
nonmutation; actual Arimo/Gelasio kerning, ligature, combining and RTL cases;
eight native/prepared browser pixel-and-copy pairs with identical decorations;
colored ligature/link/decorations; native body/list/table XML formatting; and
fresh-package editor/browser acceptance. The 805-slide baseline is unchanged.
See the joint-source evidence checkpoint for exact runtime hashes and results.

This does not certify shaping across font changes, paragraph bidi/itemization,
all scripts/fallback, arbitrary fonts, universal color-boundary rendering, or
native Office equivalence. Existing native variable-font comparisons keep their
original tolerances and remain explicit release requirements for that work.
