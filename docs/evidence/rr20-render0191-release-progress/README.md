# Renderer 0.19.1 release progress

Renderer 0.19.0 failed before npm publication because its ordinary publishing check still selected the historical v1 golden baseline. Its tag remains immutable. Source repair [renderer #238](https://github.com/OpenPresentation/opf-render/pull/238) merged at `832f873b93da58443a8d316dfd706df4f0ee3e83`; strict version-specific font-count prerequisite [core #637](https://github.com/OpenPresentation/opf/pull/637) merged at `8a578e2d9e7d8cdf9ee6970a774bd26a4fa10e6f`.

The actual renderer 0.19.1 metadata passed all 18 local qualification steps against published core 0.19.0 and Gallery 2.0.0, using Node 24.21.0/npm 11.16.0 and the ordinary publishing environment without golden, source or candidate overrides. Evidence covers 118 package test files, 807 strict example slides, 498 strict layout-template cases, 204 packed files, and the registered browser, font, variable, rich-text and code-browser checks. This is local package qualification, not native PowerPoint acceptance or registry publication.

[Release preparation #239](https://github.com/OpenPresentation/opf-render/pull/239), head `02ddd3bdd1c0042be6465b4c469ed4491de4fbff`, was opened through the canonical release-train helper. Before staging, its exact base, four changed paths and metadata bytes were compared with the independently reviewed and tested preparation. No runtime, baseline, font or workflow changes are in the preparation.

The direct dependency trailer selects [official ecosystem roll #638](https://github.com/OpenPresentation/opf/pull/638). Both PRs are under one all-check merge gate. Actual merges, release-commit checks, trusted publishing and independent registry/provenance verification are still required. T35 remains open; execution progress remains 27/40.

The copied JSON files contain the executed commands, exit codes and identity proofs. Their scratch-log paths locate the original supervisor session output; those paths are not portable deliverables. `copies.json` records the copied evidence hashes.
