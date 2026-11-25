---
type: changed
packages: [opf, render, pptx, editor, gallery, cli, mcp]
---
Breaking (0.37; no slide draws differently, and `opf fix` makes every change below): eight keys of 0.36 are renamed so that one idea has one name, with no alias. A deck that still writes an old name fails validation (`opf/schema` at the key, a message that names the new key, the safe fix `rename-key`; `rename-value` for a value). Schema removals, as the gate prints them: `font-scheme.schema.json:properties.languageFamily` (the font scheme record also becomes a closed object).
    - A font scheme's `languageFamily` is `scriptGroup`, and its values are `latin`, `eastAsian` or `complexScript`; `ea` and `cs` are no longer accepted. The 93 font scheme records of the gallery are rewritten (they draw the same).
    - A styled table cell's `verticalAlign` is `anchor`.
    - A speaker's `organizationId` is `organization`.
    - A composition's `minFontSize` and `maxFontSize` are `minFontSizePx` and `maxFontSizePx` (the same numbers, in reference pixels).
    - A reference's `url` is `link`, and it must be an http, https, mail or phone link; `opf validate` offers `Add https://` (not safe) for an address without its scheme.
    - A picture or gradient background's `tone` is `appearance`; the deck's own `tone` is unchanged.
    - A combo chart's `line` is `lineSeries`.
    - A chart reference line's `stroke.dash` also accepts the eight other preset dashes a shape outline takes (`longDash`, `dashDot`, `longDashDot`, `longDashDotDot`, `sysDot`, `sysDash`, `sysDashDot`, `sysDashDotDot`); the preview draws them and the PowerPoint export and import carry them. A table cell border keeps `solid`, `dash` and `dot`.
    - Exported names that follow the keys: `normalizeLanguageFamily` and `LanguageFamilyName` are `normalizeScriptGroup` and `ScriptGroupName`; the option `tone` of `resolveColorRoles` is `appearance`; `stats` lists a speaker's `organization`; the composition options `minFontSize` are `minFontSizePx`; the `url` of `Reference`, of a laid-out note and of the editor's reference functions is `link`; the `line` option of the editor's `setChartOptions` is `lineSeries`; the `verticalAlign` field of the editor's table cell style is `anchor`. New: `renameRecordKeys`, core's one table of renamed keys.
    - PowerPoint: the records store the new names. A file written before 0.37 still imports: the importer reads each record through the rename table. A 0.36.0 importer does not read the new names inside the records of a 0.37 file.
    - Updating: `opf fix deck.opf.json -i`; docs/migrations/0.37.md.
