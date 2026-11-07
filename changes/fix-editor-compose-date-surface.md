---
type: fixed
packages: [editor]
---
`session.composeSlide` and `session.paginateSlide` pass the host's `date` to core's slide resolution, as the renderer does. LH-164 decides a message slide's accent surface by composing the slide, and a `date: true` header or footer field without a date fails that composition. A session that added the date only afterwards could compose a message slide on the plain surface while the canvas drew it on the accent surface, so its geometry no longer matched the drawn slide (opf#1072).
