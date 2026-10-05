---
type: fixed
packages: [opf]
---
FF-46 (output-changing only for an Armenian, Georgian or Amharic deck whose design font scheme is a `cs` scheme for that language, opf#375): `resolveScriptFonts` names the chosen scheme family in the language's own `supplement` (`Armn`, `Geor`, `Ethi`) instead of the language's catalog default (Sylfaen, Nyala). An Amharic deck on Ebrima exported `Ethi` as Nyala, so PowerPoint listed Nyala in `Presentation.Fonts` although the deck chose only Ebrima. Decks that name no such scheme, and every other script, resolve exactly as before.
