# Gallery 2.0.0 publication evidence

Supervisor verified on 2026-10-12. Gallery PR #5 merged at `48169a9bb38559b8385e6791e7b5e76c0f5a8792`, whole-tree equal to reviewed `4e87de36b327ce93efbf3c8e165081bda4f10059`. The merged release commit passed its gate before tag `v2.0.0`. [Trusted publishing run 38199962362](https://github.com/OpenPresentation/gallery/actions/runs/38199962362) succeeded. The publication commit passed 2/2 checks and confirmation at 03:36:24 UTC. The batched gate exited 1 solely for independent core records PR631; its Gallery target is GREEN.

The final clean qualification used actual merged core `00022a4ed3d2576bd09c003aa38659ed5d014bc5` and renderer `0e18fb532736248ff7c96a2a3c05cbf32a86b68c`, Node24/npm11.16, with no ambient pnpm. A task-local Corepack shim provides nested pnpm; all ten normal commands, 79 tests, 28 previews, schema/catalog verification, stability, package checks and final bootstrap identity passed. The prior missing-pnpm hosted failure is retained in historical records; the correction is included in the published merged source.

Independent registry verification passed tag, gitHead, main ancestry, version, SLSA workflow/source/subject digest, one verified npm signature and attestation (zero invalid or missing), and latest. This package lane creates no GitHub Release. Initial npm processing/attestation/install propagation delays were waited out, never treated as acceptance.

The downloaded registry tarball has eight files; every byte matches the reviewed final qualification, including the original package manifest and the catalog/preview outputs. These receipts close T22 (gallery source/package), T28 (bootstrap) and T33 (publication). They do not close downstream registry adoption, stable engine publication, site pipeline retirement or native Windows acceptance. RR-80's site work remains open.

The copied source receipts are listed in SHA256SUMS. `bootstrap-review.md` retains local evidence paths for the full qualification; the successful tagged workflow independently repeats every gate. Registry and content receipts are standalone JSON.
