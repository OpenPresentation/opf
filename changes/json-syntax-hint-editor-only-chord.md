---
type: fixed
packages: [opf, editor]
---
The JSON syntax hint for a key without a value no longer ends with "Press Ctrl+Space after the colon for options." outside an editor: `analyzeJsonSyntax(text, { editor: true })` keeps the sentence (the source editor and the MCP viewer pass it), and every other caller, `validate(text)` and the CLI included, gets the hint without it.
