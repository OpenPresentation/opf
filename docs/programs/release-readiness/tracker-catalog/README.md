# Internal tracker catalog evidence

Read-only evidence extracted deterministically from verified `@openpresentation/gallery@2.0.0`, not a runtime catalog, export, or record ownership source. Gallery owns every record. `snapshot.json` contains only the package's materialized catalog JSON; no preview, font, executable or runtime file is included. `proof.json` binds snapshot bytes to the published package content hashes and independent registry/provenance receipt. The generator refuses missing or changed bytes offline.

To refresh intentionally after independently verifying a future source (update the explicit identity policy first): frozen-install the genuine published package, run `node scripts/snapshot-tracker-catalog.mjs`, then font and gallery tracker generators in that order. Snapshot extraction first verifies all eight actual installed package files against the retained published comparison and rematerializes them through the canonical materializer. Ordinary tracker generation needs only Node and committed inputs.

Schema2 layout IDs never inherit historical v1 compose/export/round-trip/parity/native/editor/site acceptance by spelling. Old-only layout rows retain historical evidence and are marked as historical, outside the current gallery2 catalog. Offline/native packets do not constitute fresh native acceptance.
