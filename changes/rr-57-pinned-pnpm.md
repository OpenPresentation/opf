---
type: changed
packages: []
---
RR-57: CI sets pnpm up with the repository's own `.github/actions/setup-pnpm` instead of `pnpm/action-setup`. The action downloads the pinned pnpm 10.33.2 release asset, checks its SHA-256 against a table in the action and puts it on PATH, so CI no longer installs pnpm through npm (`npm ci`, then a second download by `pnpm self-update`). On Windows the package-manager helpers and the CLI packed tests spawn the standalone `pnpm.exe` directly when there is no `pnpm.cjs`. No published package changes.
