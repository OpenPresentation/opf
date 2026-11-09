# RR-114 font compatibility follow-up

Current source checkpoint: all four CI failures from completed run 42707671494 were reproduced on untouched reviewed e7dc in a fresh isolated worktree. All four now pass. Four new native slide/theme XML comparisons against a whole-pack handle also preserve the before/after outlined SVG, strict Emoji glyph refusal and repeated-export face counts. Demand/fault neighbor qualification and coordinator review are pending at this checkpoint; no aggregate, release, native Office or golden acceptance is claimed.

## Vetoable decisions

- Keep strict prepared-face and missing-glyph checks. Native preparation has an explicit ensure-only preserveChosenFamilies mode: role resolution retains a substituted authored family/weight, while the recording measure selects physical face metadata. Cache identity includes the mode, generation, mapping callback and the existing selection context. Default Node preview and browser preparation retain their existing behavior.
- Safe native mapping belongs outside the raw script planner. The private analysis binding maps resolved role inputs and outer measurement, then lets generated fallback families use the raw recorder. Pure Emoji safe export therefore adds Noto Sans bold rather than unused Arial/Arimo. No special-family heuristic or whole-family preload.
- Tests prepare the same catalog context as drawing. The Arimo strictness control explicitly prepares ASCII Arimo before asking that face for unsupported Armenian. Covered Emoji/Math/CJK demand cases assert selected files plus actual coverage; explicit no-presentation full-pack and atomic browser loading checks remain intact.

## Reproduced boundaries

- Original registry-glyph-fallback: native Segoe UI Emoji title preserved requested 700, but preview preparation held only Noto Sans 400 plus Noto Color Emoji 400. Missing Noto Sans 700 was soft-skipped by script planning, ending in missing-glyph for Emoji U+0041. Native mode adds exactly the bold fallback.
- Original duration timeline: preparation omitted the gallery catalogs that the actual resolve/draw helper later injected, leaving Roboto 700 unprepared. Both initial/example calls now pass the same catalogs.
- Original auto-script/Emoji assertions expected unused eager package files. Demand holds one CJK fallback title weight and the first covering Emoji/Math face. Actual coverage, 148-deck parity, browser loading atomicity, raster behavior and glyph/output assertions remain exercised.
- A new neighboring safe-control genuinely failed under the first chosen-mode implementation because its mapFamily remapped script-generated Noto Sans to Arial. The private outer mapping correction fixes that mismatch; preserve the failure log rather than hiding it.

The coordinator owns one combined mapped gate, current CI and final native acceptance. Do not push the already folded demand-fonts, chart or other source leaves. The separate RR117 formal evidence branch is never mergeable.
