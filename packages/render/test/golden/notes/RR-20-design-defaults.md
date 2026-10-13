# RR-20 design defaults — regeneration preparation

The new renderer-owned baseline is an exact unchanged copy of the reviewed core RR83 manifest (SHA2568a19f5152853388583726b6df23d44071e73e481570fd237f0081ea43be6d0b0), split losslessly by the existing golden-migrate tool. It starts with all807 hashes/sizes unchanged across127 decks. This migration is not a golden promotion or proof the new runtime matches those pixels.

Reviewed source changes use shared neutral structural rules, typed numeric table alignment and zero magnitude axes for bars/columns/filled areas. Combined core also compacts/anchors measured metric and quote content groups. Core source selector must be the reviewed Depends-On OpenPresentation/opf#646; the ordinary labeled regenerate-goldens workflow follows that PR selector and the digest-pinned Playwright image. No manual sibling pin or test tolerance change is used.

Local fixture review and six OPF/SVG/native XML demonstrations are preparation only. The workflow-generated diff/review sheets must be inspected before accepting new pixels; only that pinned workflow output may be committed. Native PowerPoint acceptance remains separate and UNRUN. Exact changed-deck counts and explanations will be appended after actual artifact review, not guessed now.
