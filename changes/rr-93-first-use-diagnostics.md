---
type: fixed
packages: [opf, cli]
---
RR-93 first-use diagnostics (two testers' findings on 0.20):
    - A value that fails a `oneOf` or `anyOf` now reports the form it was written for, not every rejected form. `padding: 12` in a table cell style was 99 errors (mostly "must be string"); it is one `must be object` per cell. The other forms are listed in `validation.alternatives` of the finding (schema `ValidationIssue.alternatives`), and `opf validate --format text` prints them on one `other forms:` line. When no form fits the value's type, the union is reported once, named by the types it accepts. A date that is neither a date nor a date-time is one error.
    - `opf validate` warns `cli/asset-missing` (`cli/asset-blocked` outside the folder or for a file that is not an image) for a relative image or logo path `opf convert` could not read, by the same rules, relative to the deck's folder or `--asset-dir`. Core `validate` still reads no files. `--only` skips the check; `--ignore asset-missing` drops it. The markdown example now ships its `assets/release-gate.png`.
    - `opf stats` counted `source 0` for a chart with inline rows and `data.source`. `charts.data` is now `{ inline, dataset, withSource }`: how the data is given, and how many charts record a source (the unused `source` count of the removed `ChartDataSource` form is gone).
    - The render, export and import reporter keeps findings that differ in their details, so a PDF report lists every embedded face (`pdf-font-embedded` has no path or message, and only the first survived).
    - Writing a new file no longer fails with `EPERM`, `ENOTSUP` or `EXDEV` where hard links are refused (sandboxes, some OneDrive and network folders, so `opf create` and `opf convert` failed): the file is created exclusively and the staged bytes copied in, and an existing file is still never replaced.
