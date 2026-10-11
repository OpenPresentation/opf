# Local v0.19 optional-engine contract implementation

Base: b597dbe099166d62067ea1cc67696c45cc268177. Final clean local head: `1921a28c6d4eea090dc368c13c75ca1b359bdc39`.
Worktree `/private/tmp/opf-v019-engine-peer-contract`, branch codex/rr-83-v019-engine-peer-contract. Original integration unchanged.

Six paths: core manifest and CLI manifest optional renderer/PPTX peers ^0.19.0; shared PEER_RANGES same; core/CLI changed fragment; exact missing-install hint in convert test; doctor fixture explicitly models0.19 peers, retains old0.18 negative case asserting incompatibility and text-only formats ready. Generic stub helper unchanged. Optional flags, versions, exact dev pins, lazy loading, gallery declarations, goldens and registry lock bytes unchanged.

Frozen pnpm10.33.2 install passed before and after edits (logs /private/tmp/rr20-v019-peer-install.log and -frozen-after.log). Lock importer records exact existing development pins rather than these optional peer ranges, so no lock alignment change is required now. No unavailable0.19 records fabricated. Registry integration remains unresolved; old dev engines do not satisfy the new runtime ranges and strict local gates correctly refuse them.

Source qualification uses ONLY owned gallery dependency symlinks to exact e0a7eee2dfe996e680b34a907cabfe41905e6d99, then existing materializer. No candidate source/registry waiver.

Focused doctor+convert20/20 PASS (/private/tmp/rr20-v019-peer-focused.log), consistency7/7 PASS (-consistency.log). Final authorized serial mapped session29444 terminal0 runner, actual mapped command exit1:9/11 steps pass including Biome, catalog-free, changes, engines, runner/text/font/browser checks and type. Core package2280 passed with1 existing skip; its node module alone refuses published renderer0.18.0 for^0.19.0. CLI182 unit tests and95 command checks PASS; only drawing-files gate refuses published0.18.1 engines for^0.19.0. Log /private/tmp/rr20-v019-peer-mapped-authorized.log, detailed owned artifacts/check-changed/tests_{opf,cli}.log. These are explicit unmet publication requirements, not green full-suite claims.

Separate honest check:breaking exit1 against real opf-v0.18.4: candidate remains genuine0.18.4 and breaking v2 schema requires a new minor. /private/tmp/rr20-v019-peer-breaking-authorized.log. No gate or signature verification disabled.

Earlier mapped-final/breaking logs record sandbox registry signature fetch failure before source checks; superseded by authorized logs. Reviewer accidentally invoked mapped checks once in this cwd then immediately interrupted130, disclosed in /private/tmp/rr20-held-inventory1821-check.log; no source edits. Final authorized repeat ran after interruption, and final source diff/clean tree verified. No reliance on overlap result.

No push/PR/release/native acceptance. Before stable core/CLI release, reviewed v0.19 version preparation, actual gallery2 registry adoption and actual optional engines must satisfy existing gates; staged tests remain a separate exact-artifact boundary.
