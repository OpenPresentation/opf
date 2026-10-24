---
type: changed
packages: [opf]
---
`opf/json-syntax` findings (`validate(text)`, `parse`, the CLI) now name the root cause in plain words instead of the parser's code name, once per cause and in position order (at most five): `message` is the cause (`` `design` needs a value. `` located at `"design":`, `Missing comma after ... (line 2).` located at the end of the previous value, `The `{` on line 3 ... is never closed.` located at the opener), `help` is what to do next, and `location` is the range to underline. Before, one mistake was reported as several findings at the token after it (`CommaExpected`, `PropertyNameExpected`, `ValueExpected`, `EndOfFileExpected`). An unclosed list inside an unclosed object is two findings (the object, then the list). Text that looks like YAML or Markdown is one finding that names `fromYaml` or `fromMarkdown`; the findings of the other formats are unchanged. The `opf/json-syntax` entry of the rule registry and `docs/validate.md` say so.
