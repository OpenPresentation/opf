---
type: added
---
FA-11: `TimelineEvent.status` exports as native shapes drawn from the deck's colors through core's `timelineMarkerShapes` and `timelineTextColor`, the same as the preview: `done` is a filled ellipse in the accent color, `current` adds a ring (a second ellipse with a background fill and an accent outline) and a bold label, and `planned` is an ellipse with a background fill and an accent outline with muted text kept at 4.5:1 or more. Import restores `status` from the marker tags (and checks each current event's ring); events without a status export byte-identically to before.
