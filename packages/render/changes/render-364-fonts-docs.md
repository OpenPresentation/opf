---
type: changed
---
opf#364 (docs): the README now says to pass the same `fonts` handle (from `loadFonts()`) to preview, validation, pagination and export so they agree with the drawn faces, and that a call without it uses core's built-in estimate (0.54 em per character, 0.62 em for capitals and digits, 0.32 em for a space, 1 em for CJK, zero for combining marks), which is too narrow for some scripts (opf#566).
