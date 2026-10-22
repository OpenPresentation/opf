---
type: changed
packages: []
---
MR-10 follow-up: the `link-workspace-packages=false` guard moves from `.npmrc` to `linkWorkspacePackages: false` in `pnpm-workspace.yaml`, so plain `npm` commands in the repository no longer warn about an unknown project config. `check:workspace-graph` now requires the workspace setting.
