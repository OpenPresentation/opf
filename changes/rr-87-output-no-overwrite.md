---
type: fixed
packages: [opf]
---
RR-87: Preserve files created concurrently during an export when `overwrite: false` (or no CLI `--force`) is selected. Publish each staged output without replacement and report `output-exists` on a conflict.
Sanitize both path separators in generated export basenames, including input-name fallbacks, so SVG/PNG ZIP entries remain flat filenames on Windows as well as POSIX.
Remove owned temporary siblings after a partial staging-write failure while preserving any pre-existing temporary-name collision.
