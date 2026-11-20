# LH110 authored partial stroke and actual paint

Shared Line retains the exact authored `{dash:"dash"}` after an unchanged native export/import. The earlier full-paint import expectation was stale. An actual public seven-slide SVG/PPTX conversion confirms that authored/imported partial stroke is exact, native width remains12700EMU=4/3px, and the native theme relationship/master color-map/luminance chain resolves to SVG `#B1B1B1` on all seven slides.

The test now checks both contracts separately: exact authored partial import, and independently resolved actual native XML width/color versus SVG. All existing helper/data/geometry/no-inference/negative assertions remain. The corrected maintained integration test passes. The initial route-resolution and frozen-head setup refusals are retained; no archive, golden, runtime or tolerance was changed. The actual package bytes and full vector/relationship/theme artifacts are hash-indexed here.
