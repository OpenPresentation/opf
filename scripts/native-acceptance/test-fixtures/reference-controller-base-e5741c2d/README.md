# Historical reference-controller derivation bases

These three files are exact Git blobs from `e5741c2dae7e1b341ca0cf6b22cbc9c2f03f6d85`. They are **source fixtures only; never execute them**. `authority.json` records their revision, blob OIDs, raw byte counts and SHA256 values.

`derive-reference-controller.mjs` verifies the closed authority and each raw file before applying the existing exact transformations. Its outputs remain the separately reviewed reference worker, wrapper and managed test; the wrapper's exact postflight stage remains bound to `f3f04183c2d38ffe3e5755a23b571b6b9ce8155e` by `reference-postflight-derivation.json`.

The live Seven controller has since gained request binding, a newer envelope and shared postflight checks. Those files are independent current implementations, not the historical inputs to this mechanical proof. Neither their new guards nor the current reference controller are replaced by these fixtures.
