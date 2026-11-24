---
type: fixed
packages: [render]
---
`ScriptFontProfile.languageSource` in `@openpresentation/opf-render/fonts` is now core's own type, so the result of `resolveScriptFonts` (whose `languageSource` can be `"text"` since 0.35.0) type checks when passed to `createScriptTextMeasurement`, `createScriptFonts` and the other script-font functions (#1408).
