---
type: changed
---
RR-81 (render#213, output-changing for Myanmar and some Syriac text): font handles with HarfBuzz now measure text advances and glyph ink with the same shaper used by vector PDF and text outlines. Direction, language, font policy features and size adjustments are preserved; attaching a shaper clears prior measurement caches. Handles without shaping WASM retain the existing fontkit fallback. Loaded HarfBuzz corpus measurements no longer permit fontkit width exceptions, while explicit fallback qualifications remain bounded.
