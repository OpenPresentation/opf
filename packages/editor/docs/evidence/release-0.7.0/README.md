# Editor 0.7.0 registry acceptance — 2026-09-15

The refreshed lockfile uses actual npm core 0.10.0, renderer 0.8.0 and PPTX 0.8.0. On macOS arm64 with Node 24.21.0, clean installation, the complete package suite, typecheck, validation, isolated packed installation, source playground, code-browser and JSON-browser checks pass.

[The packed-consumer report](packed-consumer-node24.json) verifies every shipped file byte-for-byte before and after browser checks, actual registry dependency URLs/integrities, eleven model/component suites, registry signatures/provenance and zero known vulnerabilities. Seven [offline JSON-control workflows](packed-json-browser-node24.json) verify the public entrypoint, editing/history, contextual catalog/layout choices, source preservation and keyboard behavior without external requests or page errors. The complete packed run also verifies playground author/edit/export/reimport/undo, code/blank-target editing and ten rich-input workflows. A partial JSON report is not substituted for the successful overall command.

The earlier full-package failure against core 0.9.0 and renderer/PPTX 0.7.0 remains in [the original checkpoint](../json-release-checks-20260915/README.md). Actual current registry dependencies resolve that mismatch. CI now tests the packed registry consumer before replacing packages with coordinated source links, and retains the JSON and full-package reports.

Complete CI at this release head before merge and publication. Public-site adoption is verified separately. Furniture and prepared-font shaping remain separate draft work, and browser/ZIP results do not establish native PowerPoint acceptance.
