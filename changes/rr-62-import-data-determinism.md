---
type: fixed
packages: [cli]
---
RR-62: `opf import-data --into` is deterministic. Two runs with the same data, options and deck now write identical bytes. The new slide id is `data-` plus eight hex digits of a SHA-256 over the data text and the import options (`-2`, `-3` appended if the deck already has it) instead of a random UUID, and `--id <slideId>` names it explicitly (it fails if the deck already has the id). With `--dataset`, `source.src` is the data file's path relative to the deck's folder with `/` separators (it was relative to the working directory), and `source.retrieved` is set only by the new `--date YYYY-MM-DD` instead of the clock; with no `--date` it is absent, and a re-import no longer keeps an older `retrieved`. The command moved from `src/index.ts` to `src/import-data.ts`; core's `importData` has no clock or randomness and is unchanged.
