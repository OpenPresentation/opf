# September 29 PR review receipts

These compact receipts support the [review checkpoint](../../handoff-2026-09-29.md).
They preserve exact commits, original run IDs, attempts, and executed versus
skipped steps. They are a dated capture; inspect current GitHub state before
merging an advancing branch.

- [Dependency CI](dependency-ci.json): four successful original postmerge runs.
  [Source binding](dependency-source-binding.json) records matching reviewed and
  accepted trees and changed-file blobs. This is not a new package release or
  acceptance of the entire current font-program source graph.
- [Catalog repair CI](catalog-ci.json): core #144's two original workflows
  passed on `fd3d6534dbc784554abba1b55c511df70a3ad8d5`. The external gallery
  comparison steps were **skipped** despite their enclosing job's success.
  These runs use the PR #128 dependency branch, not current main.
- A separate [local comparison](catalog-local-comparison.json) passed against
  clean pinned gallery `58aa122690489a9206e1b583e5d9eea5e8cfd84e`. It reads
  committed public files using the existing validation dependency installation;
  it does not turn the skipped CI check into a pass.
- [Fresh npm metadata](registry-metadata.json) confirms the September 17 train
  remains the latest published set. Advertised integrity and Git heads are
  recorded; metadata retrieval is not a new install or tarball rehash.
- [Application CI](application-ci.json) and [artifact CI](application-artifact-ci.json):
  PR #57's original Ubuntu/Windows jobs each contain zero executed steps.
  The [classification](application-ci-classification.json) records the observed
  account billing/spending restriction. No required test pass is claimed.
- [Program reconciliation](program-reconciliation.json): four previously stale
  open-PR references and the newly accepted PPTX #79 are merged source. FF-29
  and FF-31 remain in review because wider acceptance is unfinished. The Windows
  owner maintains the overlapping program-tracker update in core #145.
- [Catalog correction merge](catalog-repair-merge.json) and its [accepted tree](catalog-repair-accepted-tree.json)
  bind #144's integration into the pending #128 feature branch, not main.
- [Chart scale correction merge](chart-scale-merge.json) and its [accepted tree](chart-scale-accepted-tree.json)
  bind renderer #46's integration into draft #42, not main. Original package
  [CI 36541221123](https://github.com/OpenPresentation/opf-render/actions/runs/36541221123)
  passed. The separately nonblocking platform residual workflow does not clear
  native/font tolerances or the chart pair's remaining semantic/visual gates.
- [Inline-layout correction merge](pptx81-merge.json) and [accepted tree](pptx81-accepted-tree.json)
  match reviewed `a0d2779`. Its first [explicit dispatch](pptx81-final-ci-before-merge.json)
  passed on Linux and Windows after retargeting had left no automatic PR run.
  The public layout regression ran in the source suite; the separate packed
  harness verifies shipped bytes and its existing installed fixtures. This is
  not a new native Office or release acceptance claim.

[SHA-256 manifest](SHA256SUMS.json) binds the JSON receipts. Original raw CI
logs and artifact archives are retained separately; they are not republished
here or presented as reviewed visual/native evidence. No Office call, font
installation, publication, deployment, or tolerance change is part of this
receipt set.
