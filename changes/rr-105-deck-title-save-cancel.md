---
type: changed
packages: [editor]
---
RR-105: renaming a presentation now uses the full toolbar row with Save and Cancel buttons. Focusing the name opens an edit that stretches over the whole row (the row keeps its height; its other controls give way until the edit ends); Enter or Save commits as one undoable `deck-name` edit, Escape or Cancel puts the name back, and leaving the field no longer saves. Leaving it with nothing changed closes the edit and gives the row back, as does a change to the name from elsewhere; typed text stays open with Save and Cancel and is never saved or dropped by leaving. `createDeckTitle` gains the `row` option, the `labels.save` and `labels.cancel` texts (the workspace's `titleSave` and `titleCancel` labels), `saveButton`, `cancelButton` and `editing` on its handle, and the `data-opf-title-row` attribute names the row a host wants it to take.
