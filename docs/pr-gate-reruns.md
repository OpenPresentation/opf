# Rerunning checks through the shared PR gate

`node scripts/pr-gate.mjs owner/repo#123 --rerun-once` keeps the existing policy: retry failed jobs once; a cancelled workflow restarts in full. The gate still observes all required checks and never treats requesting a rerun as success.

Use `--rerun-once --rerun-scope all` when successful prerequisite jobs also need to run again:

```sh
node scripts/pr-gate.mjs owner/repo#123 --expect-head <reviewed-head> --required all --rerun-once --rerun-scope all
```

For example, sibling workflows resolve coordinated refs in a `candidate-selection` job and pass its outputs to downstream jobs. The refs resolver reads current `Depends-On` peer heads, and `candidate-gallery.mjs resolve` fetches the current PR body for Gallery authorization. A failed-jobs-only rerun can retain a previously successful selection job's outputs. Full scope requests the complete workflow rerun so that selection executes again; this describes the code path, not a diagnosis of a particular CI failure.

A rerun still uses the original workflow/head. It does not test a newer own-source commit automatically; preserve the appropriate `--expect-head` and review the selected graph. Full scope does not change the required checks, head guards, merge rules, timeout, polling cadence or quota policy. It sends one POST per failing workflow run, deduplicating multiple failed jobs from that run, and retries at most once. Successful workflows are not rerun. The printed resume command preserves full scope.

`--rerun-scope` accepts only `failed` or `all` and requires `--rerun-once`. Omitting scope preserves `failed` and the existing resume command.
