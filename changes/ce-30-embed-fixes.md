---
type: fixed
packages: [editor]
---
CE-30: `styles.layered.css` no longer cuts the source pane's code off on the left: CodeMirror's own theme is unlayered and beat every rule in the `opf` layer, so the rules for CodeMirror's elements (a `.cm-` class in the selector) now follow the layer unlayered, and the source pane and the JSON editor look the same under either stylesheet.

A `present` item in the `toolbar` list of a host that arranges the parts with `slots` is no longer dropped: it brings the Present button and the presenter, as a listed `export` brings Export (`panels.present: false` still turns it off).
