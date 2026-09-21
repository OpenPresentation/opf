Inspector could publish the starter deck into the share URL after loading another document because automatic synchronization encoded the deferred preview. Bind each encode to the authoritative source text/format and current navigation before and after asynchronous work. Preserve the previous object-root eligibility while source is incomplete, and remove the obsolete reserved legacy import query after successful publication so refresh loads the current fragment.

The existing security test now waits for the exact hostile fixture identity/count before strict visibility; every hostile-content assertion and its timeout is preserved. Deterministic tests hold encodes across hydration, edits, format changes and navigation. Two browser flows cover fragment and legacy-import entry, ordinary editing, published payloads, hash navigation and refresh. Their staged observations allow the preceding accepted document until the first new publication; they establish no starter/no later rollback and correct reimport, while unit tests cover pending-encode invalidation.

Validation: fresh Node24 frozen install/build/typecheck, 659 unit tests, focused **3/3** and full **31/31** browser checks (zero retries; 97.04 seconds), unchanged source inputs, independent source/evidence review and reviewed screenshots. New files lint clean; Inspector shell retains its baseline 3 errors / 1 warning. Original Linux 28/29 failure, decoded wrong-hash evidence and the legacy-import negative control are retained. Fresh exact-head CI and canonical deployment acceptance remain separate gates.

Current release gate: **held / unmerged**. [First-attempt application CI35638158483](https://github.com/Data-Advantage/pptx-dev/actions/runs/35638158483) passed Linux **31/31** browser cases and failed Windows **30/31**; both passed all **659 unit tests** on Node24.20.0. The Windows security case exhausted its unchanged 45-second budget during Author readiness after a 31.4-second navigation, including a 30.026-second localhost script-resource delay. Inspector fixture and hostile-content checks passed before navigation. Author checks completed after the deadline and do not count as acceptance. The diagnostic after-hook began after timeout; the cause of the earlier delivery/scheduling delay remains unproven. Original artifacts are retained; no CI rerun replaced the failure. Both new share-publication browser cases passed on both platforms. The separate path-filtered Python artifact workflow was not triggered and is not a fresh pass. The preview is READY, but no preview-browser or production acceptance is claimed. App53 remains production.

The published package train is unchanged. Explicit toolbar sharing/export freshness, destructive preset Undo all, remaining source writers, clipped suggestion details and native/font compatibility remain unresolved. Issue 88 stays open.

<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Medium Risk**
> Changes automatic URL publication and legacy import-vs-fragment precedence in a user-visible sharing path; race and query-order bugs are plausible but mitigated by focused unit and e2e coverage.
> 
> **Overview**
> Fixes a race where **automatic** Inspector address-bar sharing could encode the **deferred preview** and publish the wrong deck (e.g. starter content overwriting a loaded one-slide URL).
> 
> **`publishCurrentShareHash`** (`lib/playground/share-hash-sync.ts`) centralizes debounced publication: it encodes from the current **source text and format**, re-checks navigation/load-revision/cancellation **before and after** async encoding, keeps the existing object-root parse eligibility, and on success writes `#opf=…` while dropping obsolete **`import=hash:`** query params so refresh follows the fragment.
> 
> **`playground-shell`** now drives hash sync from **`opfText` / `format`** instead of `deferredOpfText` / parsed document.
> 
> **Tests:** broad unit coverage for the publisher guards; new Playwright flows for hash and legacy-import entry (edit, navigation, refresh, published payload checks). **`svg-security.spec.ts`** adds readiness waits for the hostile fixture before the unchanged security assertions.
> 
> A large **`docs/evidence/inspector-share-publication-20260921`** bundle records local build/unit/browser acceptance receipts. Explicit toolbar Share and other export paths are **out of scope** for this change.
> 
> <sup>Reviewed by [Cursor Bugbot](https://cursor.com/bugbot) for commit 60c91f6b97c75636f533202f4112e09dc01144e4. Configure [here](https://www.cursor.com/dashboard/bugbot).</sup>
<!-- /CURSOR_SUMMARY -->