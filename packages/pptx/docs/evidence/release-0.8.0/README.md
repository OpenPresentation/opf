# PPTX 0.8.0 registry acceptance — 2026-09-15

The release uses actual npm core 0.10.0 and renderer 0.8.0. The refreshed lockfile contains registry URLs and integrities, and a clean `npm ci` passes with zero known vulnerabilities on macOS arm64, Node 24.21.0. No local OPF source links are used for this checkpoint.

The full package test command, typecheck, validation, isolated packed install, code/provenance tests, font-variant tests and browser export/import suite pass. The direct smoke test also passes its new check that every content-type override names a real ZIP member; the fix removes only phantom slide-master declarations and leaves notes-master ordering unchanged.

[The packed-consumer report](packed-consumer-node24.json) records byte-matched shipped files, the exact installed upstream versions/integrities, zero known vulnerabilities and verified registry signatures/provenance. It tests both absence of the optional renderer and accepted quote/code export/reimport when the published renderer is installed.

CI now runs the packed registry test before source linking, on Linux and Windows. Those checks must pass before merge and publication. This is portable package/browser/ZIP acceptance, not PowerPoint COM acceptance. The native image, tab and Office-recovery constraints remain open; no COM process action was attempted. Shared furniture and prepared-font shaping remain separate draft work.

## Standalone publish fixture correction

The first tag workflow [35004570488](https://github.com/OpenPresentation/opf-pptx/actions/runs/35004570488) failed before `npm publish`, which was skipped. [Its exact failed-step log](publish-standalone-failure.log) is retained. Although the initial local npm dependency graph contained no links, timeline tests still imported adjacent renderer `dist` files, and font-variant tests resolved Fontkit through the sibling renderer checkout. Local/coordinated CI therefore did not establish standalone acceptance for those fixtures.

The fixtures now resolve the installed renderer's public exports and package manifest. The packed-install gate runs the actual timeline and font-variant fixtures in its temporary consumer, where no sibling checkout exists. That passes 16 timeline exports with source/edit/clearing/reorder/damaged-group/overflow controls, seven payload slides with all nine physical font styles, and the earlier quote/code checks. It still verifies 26 shipped files, registry signatures/provenance and zero known vulnerabilities. The package tarball integrity is unchanged: this is a test correction, not a runtime change or relaxed tolerance. The native-font diagnostic's dependency resolution was corrected too, but no native application test was run.

The initial failed tag was created during this release attempt, and npm still reports 0.8.0 absent. Finish review and Linux/Windows CI before retrying publication from the corrected commit; preserve the original failed workflow evidence.
