# RR-114 cold-start attribution diagnostic — draft

Evidence only, NEVER MERGE. Prepared during the formal RR-117 quiet window; writing these files did not execute Node, build, profile, or change the frozen runtime. Syntax/unique-anchor checks and actual execution remain owed.

## Exact source and inputs

- Runtime: ed29f47f092aeefbde5fabac26d395f92c6b7823, tree6d6d7703b4a6b56b63565dc7cfb83bdff320b829.
- Accepted normal build source:3857ff1bbc467ddb0d0031bc400e159d120b67b9, tree6d43e3c18ffe2a2c7e5cb953dabc3681e456e661.
- Frozen current demand-font checkout cc0e32402f77962fa84d3f04681e45aad0bcffcb has the same package/spec/lock/workspace inputs. It is read-only and must not be used for a new build.
- Accepted comparison evidence4d1ffa78440c47d955d9883575d347996325bf40, archive102118B SHA1470fa8ce1d23d0f6fc146e36a3ea0d8fec809d2a4c0b5a31b8acfbc3d1a1bf0.
-16slide input48696B SHAe14be44e63a8bbe4e64c5bdd2b6d95194ed39dc5e67c09c5a6a1225d13396a29.
-36slide input98976B SHA249a8912ce59d7d55988d04b41909033017eb285b239960cb7fba6fab8d62599.
- Node24.20.0, pinned existing packages, original office/visual policy and batch-fonts options.

## Launch gates and protocol

Root must end formal70527 quiet before helper checkout/install/build/syntax-check/execution. Create a new short isolated helper branch from fresh origin/main, normally align exact reviewed runtime inputs, and copy these files onto a private evidence-only branch. Never edit/rebuild frozen demand-fonts or its dist. The isolated helper's packages/spec/lock/workspace must equal ed29. A normal local build, if necessary, produces byte-identical render copies. Freeze source/driver before launch; root reviews exact bindings.

Use one run-diagnostic.mjs invocation with explicit runtime checkout, accepted svg-performance evidence folder and fresh external output directory. Four fresh children run once each:16whole,16demand,36whole,36demand. Every child has a45s parent deadline and performs first+two warm renders, as the accepted driver does. No retries. Any first real failure/timeout stops dependent cases and preserves stdout/stderr/partial receipts. GC and SHA checks remain outside render timing. The old eight-child statistics are preserved unchanged.

Each result must have131whole or3demand faces, no pending resources, and exact original standalone SVG bytes.104per-configuration slide outputs across four children produce312per-render hashes; each is checked against the accepted uninstrumented archive. No font bytes, glyph text or private inputs are emitted.

The in-memory Node24 registerHooks loader requires each of six exact module hashes and every replacement anchor exactly once. It records pre/post loaded-code SHA and unique anchor names. It does not write dist or skip/alter checks. Modules:
font-demand, lazy-fonts, script-font-pack, fonts-node, font-registry, svg.

## Questions and counters

1. How many face-analysis generations actually occur, which slides miss each cache, and do selected faces change? Record context generation/held/needed, existing font-analysis decks/slides/designs and script-scanner string counts. Time script analysis, face analysis, recording composition and recording drawing.
2. How much preparation is local reads/hash verification/face parsing versus CPU planning? Coarse per-resource read/hash and per-face parse spans record counts/bytes, without changing validation.
3. How much actual shaping occurs before/after the engine handoff? Count coverage calls/characters, metric-cache hits/misses/outline upgrades, actual fontkit and HarfBuzz shape calls, and the cache entries discarded by setShaper.
4. What remains in the first actual batch? Record real SVG composition/drawing spans and original driver totals/import timing/CPU/memory. Real SVG drawing includes outline/subset serialization; residual time is not automatically assigned to one subsystem.
5. Script strings and design families already have caches; determine actual deltas instead of asserting all script scanning repeats.

All nested/concurrent spans are INCLUSIVE and NOT ADDITIVE. Counter/timer/loader overhead makes these attribution diagnostics, not replacement performance figures. First+warm output equality proves semantics for these inputs only. It does not prove every deck/native/browser/mobile/cloud performance.

If phase attribution remains uncertain after the four children, ONE36-demand CPU-profile child is permitted by root, with the same fresh process/deadline and separate output. It is not automatically launched or used as a new performance statistic. No optimization choice or production edits before actual evidence.

## Existing measured arithmetic, preserved

36slides: preparation291→2047ms, first batch3196→1913ms; combined3487→3960ms, approximately473ms/13.6%slower.
16slides: preparation267→1063ms, first batch2048→1035ms; combined2316→2099ms.
Module import is separate. Source-derived suspects are repeated recording passes after coverage generation changes and fontkit metric work discarded when HarfBuzz attaches. Neither is a measured attribution yet.
