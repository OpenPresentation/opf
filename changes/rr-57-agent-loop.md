---
type: changed
packages: []
---
RR-57 (tooling only, no package change): a Claude Code PostToolUse hook (`.claude/settings.json`, `scripts/agent-format.mjs`) runs Biome on each file an agent edits, applies its safe fixes and reports the errors that fail `pnpm lint`; `scripts/agent-slot.mjs` limits heavy commands (`pnpm typecheck`, `pnpm test`) to three at once per machine, across worktrees (no limit when `CI` is set); `pnpm check:changed` runs Biome, the mapped checks, the type check and the package tests for the changed files only.
