# SH-24: exact treemap archive metadata cause

The combined five-source check on `ef5405b3` failed its strict treemap fallback archive lock. A pure derivation reproduces the observed failure digest exactly by changing only the inverted-pyramid layout's provenance hash. This is the consequence of PR1216's reviewed public description correction; it is not an additional chart drawing, workbook, font or newline change.

This is an **evidence-only branch: never merge it as product source**. No exporter or build ran for this proof, no fixture changed and no generated lock was promoted. The original combined run remains RED. The other eight nine-deck cases and the 21-deck contract are not qualified by this proof.

## Exact inputs and result

- Reviewed producer: `513156a982397eaa0033808215fbb86dd284745b`, Node24.20.0 / Windows, from immutable evidence commit `5e89a184ffc8a38539f5fb5e573f403066bcca17`.
- Existing published source: `docs/evidence/rr105-034-archive-review/nine/treemap-category.zip`, inner `after.pptx`. No107KB archive is duplicated here.
- Reviewed archive:107,595bytes, SHA-256 `d1e56048a3953d90d9f81232afd6f8f6ba79e66a286eb9c28873e065cbb21394`; an unchanged repack reproduces EVERY byte.
- The only source-record change is the inverted-pyramid `description` removing the unqualified-live-status suffix. Maintained gallery embedding removes `$schema`, `id` and `x-*`; maintained canonical FNV-1a yields `4baa264255f9f66b` before and `22f5fe00efa7a1f8` after.
- Only `ppt/tags/opfLayout18.xml` changes:519bytes before/after,21 changed raw bytes in the hex-encoded record hash.149other parts, including the full nested XLSX, are byte-identical.
- Derived archive:107,591bytes, SHA-256 `c844c8abe2f223546f9a735e27f16cb0e036dd7c519b01992e02df5c22639079`, exactly the digest reported by actual `test/chartex.mjs:433` in combined run86997. That failed test kept its archive in memory; this proof does not pretend to retrieve its discarded bytes.
- Sorted ZIP entries, level6 and the maintained local1980-01-01 default reproduce the reviewed container exactly. All150 entries preserve method8, DOS time0/date33. The four-byte container-size reduction is compressed tag metadata.

`receipt.json` retains both raw Git source records, their SHA-256 values, the exact21 byte offsets, full150-part before/after hashes and ZIP headers, published provenance locator, maintained tool identities and seven protected source objects. The existing corpus/archive evidence remains immutable.

## Read-only reproduction

From this worktree with pinned Node24, pass an existing dependency-installed OPF checkout to resolve its unchanged fflate0.8.3:

```powershell
node docs/handoff/2026-11-09/sh24-archive-metadata-proof/prove.mjs C:/opf-work/integration-034
```

The default command only reads Git blobs and the receipt, computes in memory and prints the result. It writes no archive, source or fixture and invokes no exporter. The one authoring `--write` call created this JSON once with exclusive-create; do not use it to replace earlier evidence. Git object access under short C:/opf-work paths needs the established elevated sandbox context on this machine.

Validation here is the actual unchanged-container control, exact-source/record-hash checks, one changed-part assertion, all150 part/header comparisons and observed full-digest equality. Syntax and whitespace checks are separate bounded checks. No full package suite or mapped build rerun was used for this evidence-only derivation; final maintained archive review/promotion and combined acceptance remain coordinator work.

Vetoable decision: attribute this ONE locked-archive mismatch to the exact SH-24 description/provenance metadata change. Preserve the failed gate; do not weaken it, hand-edit expected hashes or generalize this proof to other decks or future source.
