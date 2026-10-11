# Local patch site acceptance — 2026-10-11

Actual registry dependencies are core 0.18.4, renderer/PPTX/editor 0.18.2 and CLI 0.18.1 where declared. The identity and lock receipts bind the installed graph. This is local acceptance, not deployed-site or v0.19 acceptance.

Main site: serial runner 84360 exited 0. Typecheck, full site tests including 27 executable snippets, production build, font checks and all 75 localhost browser tests passed. Browser coverage includes PDF/PNG/SVG/PPTX exports and 894 sitemap pages with 79,155 internal references. The unchanged worker report and identity/hash receipts are retained here.

Showcase: reviewed source fix [opf#626](https://github.com/OpenPresentation/opf/pull/626) embeds the authored catalog before rendering. The unmodified paired registry generator (57501 exit 0) reproduced all four independently reviewed artifact hashes; mapped checks (30686) passed. The earlier rejected output remains historical evidence. This corrects the missing catalog/font context; it does not establish native PowerPoint acceptance.

Gallery: full 628 tests, typecheck, production build, font/media checks and all 91 localhost browser tests passed. Chart regeneration changed only the renderer version in its manifest; all 27 SVG bytes were unchanged. The registry editor generator validated/rendered 653 documents and generated 767 schema fields. No deployment occurred.

Dev: full 970 tests (one existing skip), typecheck and production build passed. The original browser failure was traced to asserting before the authored Japanese slide replaced the starter. A separate correction waits for the exact slide ID and title while preserving the font request, same-origin, Intos and export assertions. Focused 1/1 and full 58/58 browser tests passed; the integrated test and package/lock bytes match the qualified graph at 374ed8bb8abadf3fc3ffee5519955981a0b22f84. Original failure evidence is retained in the dev repository. Lint remains failing on diagnostics also reproduced on the untouched base; runtime correctness repairs are separate and incomplete.

Source-lock CI, merged records/site adoption, remaining dev lint, Windows-native acceptance and final v0.19 publication are still open. Progress remains 15/40; no checkpoint closes from these local results alone.
