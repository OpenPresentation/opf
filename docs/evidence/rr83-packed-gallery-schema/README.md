# RR-83 packed gallery schema contract

This test-only follow-up is stacked on promoted core qualification `91a1c96df7b4bddf7144c71ea079220765b9360b`. It is not directly mergeable to main before the v2 dependencies and genuine source metadata prerequisites.

`git blame` attributes the stale packed-smoke `catalogSchema === 1` assertion to `66ec5dd8c8cf4224ca66e96b75f315f93cfae13b` (RR-78 gallery adoption, core PR 557). The final v2 source requires catalog schema 2. Its existing gallery-default tests verify that contract and reject schema 1, but the separately invoked packed consumer retained the old assertion.

The correction expects schema 2 and additionally compares the installed core's public `CATALOG_SCHEMA` export with the installed gallery's manifest. This verifies the actual tarball pair rather than only checking the source fixture. Default main's v1 expectations are untouched.

Original failure: `/private/tmp/rr78-replay-core-packed.log`, core `37d96a28aeba2be28a9d4bde5f1aca73264c1a03` with explicit candidate CI implementation/staging and gallery `e0a7eee2dfe996e680b34a907cabfe41905e6d99`. Disposable diagnostic commit `d3b2c211` corrected the one expectation; the complete actual packed smoke passed, including installed declarations and 101 tar entries: `/private/tmp/rr78-replay-core-packed-diagnostic.log`. This diagnostic result does not qualify unchanged v2 source or prove registry installability. The complete actual packed smoke, including the additional installed-public-export assertion, passed on disposable replay commit `6b468f20`: [public-schema-smoke.log](public-schema-smoke.log). The original failure and expectation-only control are retained as [original-failure.log](original-failure.log) and [expectation-only-diagnostic.log](expectation-only-diagnostic.log).

No runtime, registry metadata, baseline, tolerance or source version changes are included.
