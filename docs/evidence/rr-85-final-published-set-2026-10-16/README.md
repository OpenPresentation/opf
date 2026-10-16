# Verified package set (2026-10-16)

Core **0.20.3**, renderer **0.20.2**, PPTX/editor **0.20.3**, CLI **0.20.0** and Gallery **3.0.0**.

[Selected artifacts](selected-artifacts-final.json) binds all six archive hashes and all 13 compatible runtime dependency/peer ranges. Core/CLI/Gallery retain their exact previously verified artifacts; the three new sibling archives match their genuine trusted publisher/SRI. [Publication authority](verified-registry-authority-final.json) retains all canonical verification checks, including signatures and SLSA. Maintained terminal logs: [renderer](render0202-trusted-publication.log), [PPTX](pptx0203-trusted-publication.log), [editor](editor0203-trusted-publication.log). Earlier [Core3 selection](../rr-85-published-set-2026-10-16/README.md) and its authorities remain unchanged dated records.

Core 0.20.2 introduced default metric centering; these sibling releases raise its floor while explicit alignment remains authoritative. Core 0.20.3 adds the Validation results annotation. No RR86 native prototype is included. The editor's immutable host-example source remains `2ac0268359f48123031ef537fcc0c31d7c41a1df`, distinct from its library publisher.

The committed matrix-consumer mirror is refreshed by the unchanged `prepare-consumer.mjs --update-lock`. Its qualification is separate from the canonical registry producer and site adoption. After independent review and commit of this exact docs-only plan, unchanged merged producers and site qualification may overlap its normal PR integration; manifests bind real publishers/SRIs, not the plan checkout as a package publisher. Final integration and actual site gates remain required. No native, final-site or overall-program acceptance follows from this record.
