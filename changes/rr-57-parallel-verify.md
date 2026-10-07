---
type: changed
packages: []
---
RR-57: the required "Verify OPF packages" job runs `pnpm test` as a background step while the packed-install, packed-CLI, peers and quickstart steps run in the foreground, then joins them with `wait` (GitHub Actions parallel steps), without a new runner and without dropping a check.
