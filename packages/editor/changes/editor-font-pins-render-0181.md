---
type: changed
---
Development only: the editor's font test packages match opf-render 0.18.1's pins: `@expo-google-fonts/noto-sans-jp`, `-kr`, `-sc` and `-tc` 0.4.4, `noto-color-emoji` 0.4.7 and `noto-emoji` 0.4.8 (render#210). With the old files, the renderer's manifest check refuses them (`font-integrity-mismatch`). No editor code or output changes.
