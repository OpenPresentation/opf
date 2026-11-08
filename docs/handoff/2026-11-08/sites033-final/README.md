# OPF 0.33 final site evidence

This is an evidence-only branch. Never merge it. Source changes remain in org PR #202, gallery PR #172 and dev PR #200. The unified checklist is https://github.com/OpenPresentation/opf/issues/1139.

The exact final dev head has a successful existing PR deployment. All 12 anonymous inspector/source-pane Edge cases pass, and the deployed manifest plus all 13 canonical diagram SVGs match the released hashes. No manual deploy, login, backend mutation, DNS change or site default-branch merge occurred. Raw responses, browser output and the reproducible byte-check helper are compressed beside the receipt, with uncompressed lengths and hashes.

The preserved third site-gate log was stopped when the coordinator took the sole observer slot for core doc-only PR #1188. This packet does not claim all three final CI gates are green. Org still awaits the actual merged 0.33 documentation commit, a supported same-version documentation pin refresh, and new final CI. Org and gallery still require real PR preview URLs supplied or created by the owner.

Current checkpoint after actual 954 documentation adoption: [checkpoint-954.json](checkpoint-954.json). Org PR202 is pushed at baf63e47 with clean source and complete current-example/local production checks. Gallery/dev retain their verified heads; dev has exact-head deployed-preview acceptance. The only observer is active session4057; terminal CI is not claimed yet. Org/gallery deployed previews/default merges and external UI/MCP artifacts remain open. The older paragraph above retains its historical pre-1188 state.

[Independent read-only survey safety review](readonly-survey-independent-review.json) and all30 pure boundary/ValidateOnly/refusal controls are preserved separately. No Office was used by this reviewer; the coordinator owns the subsequent actual92-shape qualification. This remains an evidence-only branch and must never be merged.
