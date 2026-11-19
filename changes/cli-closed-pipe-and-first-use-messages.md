---
type: fixed
packages: [cli]
---
Piping the CLI into a reader that closes early (`opf schema presentation | head`, `opf catalogs | jq`) no longer throws an unhandled `EPIPE` with a stack trace: the command stops quietly and exits 141 (128 + SIGPIPE, as `cat` and `git` do), for stdout and stderr in every command. `opf paginate --check` now reports why it failed: one `cli/slide-would-split` finding (with the slide's JSON Pointer and a help sentence) per slide that would split. A typo of a removed command (`opf rendr`) names the replacement instead of only "unknown command". The README states the exit codes as they are: invalid JSON, YAML or Markdown exits 2, except in `opf validate`, which reports it as a finding and exits 1.
