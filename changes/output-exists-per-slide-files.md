---
type: changed
packages: [opf, cli]
---
The `output-exists` refusal of a per-slide output (`png/slide-{n}.png` into a folder that holds the files) says how many of the files would be replaced, that nothing was written and that they are unchanged, and that `--force` replaces them. The exit status was already 1; the message now cannot be read as a refresh.
