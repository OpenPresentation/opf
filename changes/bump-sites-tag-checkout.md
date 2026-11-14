---
type: fixed
packages: []
---

The site bump after a release gives each site's script a checkout of the release tag that includes `packages/gallery` (pptx-gallery prepares its layout examples from the package's preview sources). The v0.33.0 and v0.34.0 bumps of pptx-gallery stopped with `spawnSync git ENOENT` because that folder was not checked out.
