Pasting JSON into the shared Inspector/Author code editor could asynchronously rewrite indentation and remove a final newline. Disable implicit paste formatting while retaining explicit Format Document and exact undo.

The regression invokes the real formatter, verifies its edit/undo, warms the normal model-change path, then checks unchanged pasted bytes after completed worker validation. The old build fails with a 302→443 byte rewrite; the fixed build preserves all 302 bytes. The long-quote test also carries its existing 20-second font-readiness budget through the recently added preview helper.

Validation: fresh Node24.21.0/pnpm11.1.3 frozen install, build, typecheck, 622 unit tests and 19 browser workflows pass; independent old/fixed control review and changed-test lint pass. Evidence is in `docs/evidence/explicit-formatting-20260921/`. Hosted Linux/Windows CI and canonical deployment acceptance remain separate gates.

OpenPresentation/opf#88 remains unresolved: the earlier intermittent CRLF Author popup remains unexplained. No package pins, fonts, goldens or native compatibility claims change.

<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Low Risk**
> Single Monaco editor option plus e2e and evidence docs; no auth, data, or dependency changes, with explicit formatting still available.
> 
> **Overview**
> Disables Monaco **implicit paste formatting** in the shared `OpfEditor` (`formatOnPaste: false`) so pasted JSON keeps authored whitespace and trailing newlines; **Format Document** and undo stay unchanged for Inspector and Author.
> 
> Adds **`json-paste-formatting.spec.ts`**, which warms the formatter via F1, round-trips YAML/JSON tabs, observes Monaco worker RPCs, and asserts byte-identical paste plus no `format` worker calls after paste. **`inspector.spec.ts`** passes the existing **20s** font-readiness timeout into `singleSlidePreview` so the long-quote test is not capped by Playwright’s default assertion timeout.
> 
> Acceptance artifacts land under **`docs/evidence/explicit-formatting-20260921/`** (control runs, logs, hashes). Scope is editor-buffer paste only—not canvas serialization, JSON download, or issue88 CRLF popup.
> 
> <sup>Reviewed by [Cursor Bugbot](https://cursor.com/bugbot) for commit 59e888580c38ca5cfbf5105b2ec09c2bfc956ca1. Configure [here](https://www.cursor.com/dashboard/bugbot).</sup>
<!-- /CURSOR_SUMMARY -->