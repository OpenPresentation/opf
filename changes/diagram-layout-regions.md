---
type: added
packages: [gallery]
---
Layout regions that hold a figure accept the new `diagram` kind: `charts` of `chart`, `chart` of `chart-beside`, `media` of `image`, `image-beside` and `hero`, `first` and `second` of `comparison` and `two-column`, the three columns of `three-column`, `steps` of `process` and `timeline` of `timeline`. A slide that pins a diagram to one of these regions, or binds one by kind, now places it there instead of reporting `region-kind`; no record draws differently.
