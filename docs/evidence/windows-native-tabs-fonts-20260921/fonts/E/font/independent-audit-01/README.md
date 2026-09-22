# Native font edit independent audit

`report-v2.json` is the passing offline audit (16/16 checks) for `native-font-edit-01`. It uses Python standard-library parsing and hashing only. It does not copy font programs or invoke Office/COM, register fonts, install fonts, or run PowerPoint UI.

`report.json` preserves the first auditor attempt. Its one failed check was an audit-script mistake: `audit.py` required a `$succeeded` marker that the actual helper does not use. The helper iterates its owned additions and records the result of `RemoveFontResourceExW`; `audit-v2.py` checks that actual implementation and passes. This was not a run or artifact failure.

The worker observes the body as a whole and its four explicitly styled ranges. It does not separately query the three separator ranges; the whole-range bold and italic observations are mixed-value sentinels (`-2`). The input sequence sets the whole body regular before applying the four styles, but the raw observations do not independently establish the separators' final style.

Current-registry `fromPptx` semantic reimport is left to the parent audit.
