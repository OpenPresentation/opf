---
type: fixed
packages: [opf]
---
FF-46 (output-changing only for an Armenian, Georgian or Amharic deck whose design font scheme sets `complexScript` or is a `cs` scheme for that language, opf#375): `resolveScriptFonts` names the chosen family in the language's own `supplement` (`Armn`, `Geor`, `Ethi`) instead of the language's catalog default (Sylfaen, Nyala). An Amharic deck on an inline Ebrima scheme with an explicit `complexScript` slot exported `Ethi` as Nyala, so PowerPoint listed Nyala in `Presentation.Fonts` although the deck chose only Ebrima. East Asian and complex-script languages already follow their slot, and decks that name no such slot or scheme resolve exactly as before.
