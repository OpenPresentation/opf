---
type: added
---
FA-26 (needs core 0.16.0): layout records with nested placeholder groups in the editor. The canvas composes the same leaf boxes as the preview and the PPTX export; the layout picker, the JSON field menu and "Add slide with layout" name nested slots (`title, column (text, text), chart`) and compare layouts by their leaf regions; a layout switch adds the empty slots the record's leaves declare; and Arrange (`setLayoutEditing(true)`) draws every slot of the record (`geometry.slots`) as an outline at its cell, labelling the empty ones.
