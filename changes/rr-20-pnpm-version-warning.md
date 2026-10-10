---
type: fixed
packages: []
---
RR-20: the #525 `check-changed` test reads pnpm's version from the last line of its output. In `npm-publish.yml`, setup-node writes an `.npmrc` that references `${NODE_AUTH_TOKEN}`, which is unset before the publish step, so pnpm prints a configuration warning before the version. That made the publish run for `opf-v0.18.2` fail, and 0.18.2 was never published; the patch ships as 0.18.3.
