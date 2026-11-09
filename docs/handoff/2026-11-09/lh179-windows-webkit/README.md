# LH-179 Windows mobile browser setup

Source base: integration1ef0e17a58198defa34cd515ad7078d56a7d97d0, normally included after fresh origin/main9545016583ccfa151077cda4d51043ac6505a140. Worktree C:/opf-work/lh179-webkit, branch codex/lh-179-windows-webkit.

Confirmed CI setup failure: Full CI run42642923443 job129248453244 refused the mobile audit because pinned WebKit2370 Playwright.exe was absent; the new Windows job installed only Chromium. The audit defaults to both Chromium and WebKit.

Vetoable decision LH179-WEBKIT: add pinned WebKit installation only to the browser shard selected for mobile-touch by the maintained suite. Preserve both engines, all mobile scenarios, the complete existing matrix, all timeouts and performance budgets. No library, schema, lock, browser version or golden changes.

The maintained workflow regression derives the owning shard from actual suite order and reads the default mobile engines, forbids an engine override and checks installation in the owning shard. It genuinely fails before the workflow repair with missing WebKit. Local qualification is pending. Actual Windows CI and mobile-page execution remain owed; no provider/Office/release actions occurred.

Independent failures remain open: Linux source-worker YAML paced inflight50ms exceeds40% of115ms, and Windows Studio drop p95 is460.3ms above450ms. No fallback was observed in the worker log; only bounded local profiling is authorized, and this setup repair does not claim either timing failure cured.
