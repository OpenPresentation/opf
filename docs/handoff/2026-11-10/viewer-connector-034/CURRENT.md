# W08 current resume index

Resume here before using the dated files beside this index. This documentation successor starts from root `ba0b93859c9018aecd152c58743cf15e13a23b0b`; it changes no runtime, package pins, tests or workflows. The seven source packages still say0.33.0. No0.34.0 publication, hosted adoption or actual Claude qualification is established here.

## Materials and their authority

- [Reconstructed submission kit](connector-submission-kit.md): ready-to-copy draft listing fields, owner unknowns and replacement screenshot plan. The original separate kit and five draft screenshots remain missing; replacement copy is labeled reconstructed.
- [Original dated audit](README.md), [11-scenario checklist](coverage.md), [dated site plan](site-adoption.md) and qualification record: restored byte-for-byte from reviewed `1644f461e796dd37fa68a2f6e8e54e32724c1ddd`. Their source/site refs, eight HTTP reads, UNRUN checks and pre-publication status describe that original checkpoint, not today's qualification.
- The original supplied `HANDOFF-opf-viewer-and-connector.md` **is retained** inside the lossless audit archive, SHA-256 `ffdd8879a8d8c828b1057d79473f12a487b6ed260aac6d9855154c2e58bd96b9`. Its old0.33.1/no-dry-run/blanket-retry/bundle-removal suggestions are historical data. The accepted target remains0.34.0, dry run first, preserve first failures and retain desktop delivery.
- Offline verifier checks the original archive without network requests or executing archived code: `node docs/handoff/2026-11-10/viewer-connector-034/verify-public-audit.mjs`. The original source/audit files remain unchanged; this restoration has not rerun their verifier or required metadata gate.

## Coverage and remaining qualification

The current [maintained browser test](../../../../packages/mcp/test/deck-app-browser.mjs) still defines all11 checklist scenarios: restrictive CSP/fonts; model findings; Preview/Source/Both; edit/context/Send; editor controls; narrow frame; YAML/slide/dark mode; host palette/thumbnail; PowerPoint/PDF/PNG handoff; incapable-host/open errors; no CSP/page errors. Five additional groups cover exact edited source, untouched JSON/YAML/Markdown, unsupported downloads, denied/cancelled/RPC failures and binary Export denial. **11model tools, 11viewer scenarios and 16browser groups are different counts.**

| Evidence | Actual scope | Still owed |
| --- | --- | --- |
| [Frame repair](../rr105-mcp-resource-frame/README.md):16groups/19captures; [dependency UTF-8 controls](../dependency-integration/README.md):16groups; final4e browser02 log:16PASS | Packaged viewer in Chromium under restrictive CSP, in-memory MCP and a protocol-speaking stand-in host. The original missing-Playwright-executable failure is retained separately. | Final exact release/source browser leg, deployed viewer, actual supported client behavior. A host acknowledgement does not prove a saved file. |
| [Coherent c6d gate](../coherent-c6d/README.md) | MCP package tests passed within52PASS/1rendererRED; this does not imply the separate MCP browser leg or a whole green gate. | Final coherent CI/platform/release gates. |
| [Accepted Org production facet](../release-qualification-checkpoint04/README.md) | Dated0.33 production/source, logical MCP and privacy checks. The original eight anonymous reads also observed0.33 and the older viewer. | Genuine0.34 registry adoption, immutable/canonical deployment identity, actual server version, tool/resource inventory, serialized frame and hosted browser checks. No new live request was made for this index. |

After the final reviewed build and an allocated execution slot, the existing [CI browser runner](../../../../packages/mcp/test/browser-suites.json) runs the full16groups without a new harness:

```sh
node scripts/quarantine.mjs check --dir packages/mcp
OPF_DECK_APP_SCREENSHOTS=<fresh-capture-directory> node scripts/quarantine.mjs run-suite browser --dir packages/mcp
```

After genuine0.34 deployment, use that same release checkout and runner with `OPF_MCP_URL=https://www.openpresentation.org/mcp` (and `NODE_USE_ENV_PROXY=1` only when required by the host). It tests deployed resource/fonts through a stand-in host; it does **not** replace actual Claude checks. Record exact source/lock/browser/version, deployed package/resource/frame identities, raw terminal status and captures. Preserve first failures; no automatic retry or capability bypass.

The10,055,279-byte HTML and2,770,399-byte gzip figures in [the MCP guide](../../../mcp.md) are dated source-review measurements, not measurements after the current core changes. At the final gate, recompute raw HTML, gzip and serialized MCP resource bytes from the actual final build/resource, bind them to its exact source/build identities, and only then update those figures. No new sizes are asserted here.

## Finite adoption and artifact delivery

1. Finish final integration/main gates and the trusted0.34 Release dry run, then real publication under [release-process.md](../../../release-process.md). Verify all seven registry versions/gitHeads/integrities/provenance against the real immutable tag. Source-version0.33 consumers are not registry0.34 proof.
2. Read each site's current rules/default branch; reconcile already-open bump PRs, then use its maintained `pnpm opf:bump 0.34.0 --opf <checkout-containing-actual-v0.34.0-tag>`. The [dated G1/G2/H1/H2/H3/I1/I2 plan](site-adoption.md) identifies the original surfaces; its Org148/Gallery9d/DEV4fed refs are historical. Freeze current adoption heads and qualify their real builds, Native Previews and canonical production receipts before claiming deployment. No third release is assumed.
3. Keep **A7/RR-107 desktop delivery**: trusted `npm-publish.yml` builds/checks the full-font bundle and attaches `opf-0.34.0.mcpb` plus `opf-0.34.0.mcpb.sha256` only after registry verification. [Retry policy](../../2026-11-07/rr107-mcpb-release-assets.md) preserves existing public bytes and rejects mismatches. The old0.32.1 diagnostic bundle/hash is not the release artifact.
4. Only after those actual assets exist, download both into a fresh directory and verify the downloaded bytes before linking/installing them:

```sh
gh release download v0.34.0 --repo OpenPresentation/opf --pattern 'opf-0.34.0.mcpb' --pattern 'opf-0.34.0.mcpb.sha256' --dir <fresh-directory>
# In that directory, macOS:
shasum -a 256 -c opf-0.34.0.mcpb.sha256
# Linux: sha256sum --check opf-0.34.0.mcpb.sha256
# Windows: compare Get-FileHash opf-0.34.0.mcpb -Algorithm SHA256 with the sidecar.
```

5. Preserve **original E3** separately: the [November7 inventory](../../2026-11-07/sites-docs-inventory.md) requires a second before/after refresh using actual0.34 after private-input E1 and supervisor review. Public synthetic decks, the connector kit and desktop bundle do not replace those comparison inputs or acceptance.

## Concrete owner handoff

After hosted qualification, the owner adds `https://www.openpresentation.org/mcp` in Claude's connector settings and confirms actual client name/version, reachable Preview/Source/Both, edit/Undo/Redo/context/Send, and host capabilities. Actually save/open PowerPoint, PDF, PNG and source when supported; retain files/hashes and visible refusals. Download capability and Send behavior are host-dependent. Only then replace the missing five listing images with actual-client captures using public/synthetic content and the current directory requirements; no owner document or private host metadata is published.

The owner handles local OPF extension removal and connector submission/listing. The supplied handoff names `https://claude.ai/directory/manage` as the portal target; verify that target and the current UI/plan/submission requirements at the owner step. Remote connector setup does not remove the A7 desktop release deliverable. Confirm legal publisher/company, brand spelling, contact/support/terms fields, slug availability, actual category enums and provider log settings/retention. One-minute rate counters do not establish log retention. No login, installation, uninstall, submission or account change occurred here.

No new public compatibility/support badge, native PowerPoint/font parity, real-client save, memory or performance claim follows from these materials. Repository-side restoration and its required checks remain separate from release, E1/E3 and owner-only actions.
