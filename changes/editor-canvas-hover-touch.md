---
type: fixed
packages: [editor]
---
The slide's hover outline (the light ring around a text the pointer is over) shows only for a pointer that hovers (`@media (hover: hover)`). On a touch screen the browser keeps `:hover` on the last element touched, so a scroll that started on the title left a ring that looked like a selection nobody made.
