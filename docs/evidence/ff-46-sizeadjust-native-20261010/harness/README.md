# Native run harness (opf#323 and opf#361, 2026-10-10)

These are the scripts behind the 2026-10-10 Windows PowerPoint runs. The FF-12, FF-13, FF-27 and FF-46 evidence is in opf#583; the size-adjust and lineAscent evidence is in this folder. They are kept here so a later re-measure can reproduce the runs. Decks, PNGs, logs and raw native read-outs are not committed.

- `RUN.md`: the exact commands for attempts 1 to 3. The supervisor runs Office; agents only build.
- `helpers/`: `run-deck.ps1` (one child `powershell.exe` per deck, 90 s deadline), `run-set.ps1`, `native-read-deck.ps1` (read-only, `Presentations.Open(path,-1,0,0)`, never saves or quits), `native-fields.ps1` (FF-27, in memory only), and `ff13-supervise.ps1` with `ff13-embed-worker.ps1` (one `SaveAs` of a copy, session-only font registration). `decks-order.txt` lists every deck's sha256.
- `build/`: the deck builders for the ff12, ff27, ff46, ff46sa and probe38 sets, using the published packages.
- `patched/`: the one-process policy patch used for the factor-applied re-run (`node --import ./patched/register.mjs`).
- `measure/`: the size-adjust measurement, the rule, the line model and the RR-38 re-reading. Set `RR38_DIR` to the RR-38 PNG folder.
- `compare.mjs`: turns the read-outs into `compare.md` and `compare.json`. `selftest/` has its mock-based self-test.

The paths are placeholders. `<node24>` is a Node 24 binary. The helpers default to `C:\opf-work\native-0-18-run`; pass `-Root` and `-OutRoot` to override.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
