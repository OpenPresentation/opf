# Refreshed coordinated staged graph qualification

This records local source and staged-tarball qualification only. All five serial consumers passed against a common six-package staged graph; each consumer installs its documented subset. Node 24.21.0, npm 11.16.0 and pnpm 10.33.2 were used with fresh frozen installs. Original source trees, earlier stages and native packets were preserved.

Accepted core source is `bf59164c9ba4f2a0787607f0efd0be626357b831`. Its local authorization overlay `ed107a2093335d2af5d9fa44d152cf5da4f29fa1` adds only an explicit unreleased gallery 2 declaration/configuration pinned to the gallery SHA below; it changes no source versions, ranges, locks or runtime. These local source commits are not represented as published registry dependencies. [Qualification result](qualification-result.json) binds the source, tar sizes/digests and original/staged manifest digests. [Full staged manifest](manifest.json) is byte-identical to the retained [pre-consumer manifest](pre-consumer-manifest.json). The supervisor independently checked all six tar identities after the consumers. Tarballs are not duplicated here.

| Package | Source SHA | Source version | Tar bytes | Tar SHA256 |
| --- | --- | --- | ---: | --- |
| @openpresentation/opf | `ed107a2093335d2af5d9fa44d152cf5da4f29fa1` | 0.18.3 | 3322325 | `9b6da496d4c103ae40c6cae400b076f4af5cbd06dad4b2c7105e5be19efe0780` |
| @openpresentation/opf-render | `127669807df12fbead5ea805c4d54a7c3fcbc03b` | 0.18.1 | 13073927 | `28125929e8447db19b789504d4698300e103c9bdbf50b9b319145ebbe8bca31b` |
| @openpresentation/opf-pptx | `1fae5a9df400ea37954ad4bb4fca8c2d1b96588b` | 0.18.1 | 721965 | `324d524394e70304a72c13f036195966e58bf47e42ba23fea258451e96d51d03` |
| @openpresentation/opf-editor | `d6481068f3500fc986a31e57bd8317da5882be4a` | 0.18.1 | 405128 | `d7247bb28e37bd8d6b886309d876d79543bb9479bfae908fff7b355f40ccdb0b` |
| @openpresentation/cli | `ed107a2093335d2af5d9fa44d152cf5da4f29fa1` | 0.18.1 | 196867 | `4f7f2ec07a47c820d50221a242de33fcb79dd97f8dfac1e37128a0e49ffccf69` |
| @openpresentation/gallery | `e0a7eee2dfe996e680b34a907cabfe41905e6d99` | 2.0.0 | 97319 | `6c6720115bc82021bbb810dcc4ea70e27cdaef8bb3d07b573ece64f738653ce4` |

## Serial consumers

Exact commands, exit codes and durations are retained in [consumer-results.json](consumer-results.json). Run from the explicitly staged core workspace, using the candidate graph configuration; these are not ordinary registry-install results.

- `node packages/javascript/test/packed-install-smoke.mjs`: [log](core-packed.log), exit 0; 101 entries, schema 2 and public `CATALOG_SCHEMA` contract.
- `node packages/cli/test/packed.mjs`: [log](cli-standalone.log), exit 0; 95 commands and actual global/npmexec guards.
- `node packages/cli/test/packed-files.mjs`: [log](cli-peers.log), exit 0; 77 drawing and 16 installed checks, image/font/no-fetch contracts and actual npmexec conversions.
- `node scripts/test-packed-ecosystem.mjs`: [log](installed-graph.log), exit 0; exact six-package installed bytes, shared core/gallery resolution and type contracts.
- `node scripts/test-packed-browser.mjs`: [log](installed-browser.log), exit 0; installed browser contract.

Gallery build, 75 tests, types, verification/licenses and 28 previews, engine builds and strict shared-core links passed in the fresh staging run. The original scratch report is `/private/tmp/rr20-refreshed-graph-qualification.md`; source staging was `/private/tmp/rr20-refreshed-stage`. Those local paths are provenance, not durable artifact availability guarantees.

The existing harness explicitly skips historical 0.14 SVG goldens. This run provides no fresh 807-example or 498-template golden proof. Genuine preliminary 0.19 metadata, real gallery 2 registry ranges/locks, final registry publication, native acceptance and site adoption remain pending. No breaking gate was bypassed and no checkpoint closes from this evidence.
