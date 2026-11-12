# Claude MCP Apps: accepted addition to the v0.34 handoff

The owner supplied [Claude's getting-started page](https://claude.com/docs/connectors/building/mcp-apps/getting-started) after the freeze and said, “we need to make use of this.” This extends W08; it does not replace the remaining release scope. Documentation was inspected on November 12, 2026. **This addendum is a source comparison and implementation plan. No new app functionality, hosted deployment or real-Claude qualification is claimed.** The previous coordinator remains stopped after this bounded handoff update.

## Existing foundation and actual gaps

Source inspected: coherent product commit `6cb8f52aa8dc43e37af8d5a6eda2b5ef5ebcca04`, retained in this handoff branch. These are source findings, not observations of the deployed version.

| Area | Existing candidate | Remaining work |
| --- | --- | --- |
| Interactive deck | `show_deck`, `ui://opf/deck`, shared editor, preview/source/both | Extend the same viewer |
| Display | `App` supports inline/fullscreen; user expand control; host context updates | Prefer the side panel where available; verify resizing/insets and truthful control labels |
| Model collaboration | Debounced `updateModelContext`, user-triggered `sendMessage` | Let Claude act directly in the current editor through in-view tools |
| Entry point | `show_deck` requires a document; no global entry metadata | Add a useful studio starting state callable with `{}` |
| Exports | Capability-gated `downloadFile` for source and generated exports | Check filename handling, concurrent requests and acknowledgement wording against current Claude rules |
| Instances | A new `show_deck` creates another viewer | Keep old instances from publishing stale state for the same editing session |

Primary files: `packages/mcp/app/main.ts`, `packages/mcp/app/view.css`, `packages/mcp/src/server.ts`, `packages/mcp/test/deck-app-browser.mjs`, `docs/mcp.md`. Current package pins are ext-apps **2.0.4** and zod **4.6.7**; do not upgrade dependencies merely to obtain APIs already available in these versions.

## W08-A: editing together in the open viewer

Claude's [app-tools guide](https://claude.com/docs/connectors/building/mcp-apps/app-tools) distinguishes server tools from tools registered inside the view. Register view tools before `app.connect()`; `app.registerTool` needs SDK 1.7+ and a schema object with JSON Schema output. These features require a remote connector, a loaded view and an eligible organization/conversation. Tool definitions should stay constant and results should include useful text. Claude's execution limit is 45 seconds; longer work needs a start/status pattern.

Proposed OPF contract: read the current deck/selection/revision, select a slide, and apply a bounded edit through the existing editor transaction/patch API. Use existing ids, preconditions and permissions; return the resulting revision and findings. A tool must operate on its own instance and current user-edited document. Refuse stale revisions atomically, preserve undo/source synchronization and avoid replacing an entire deck just to edit one title. Disable mutations while loading, read-only, superseded or after teardown. These are OPF implementation decisions to review, not APIs supplied by Claude.

Keep the existing interaction available in hosts without view tools. Do not introduce server storage, authentication or document uploads to the currently stateless public MCP endpoint for this feature.

## W08-B: side panel and direct app launch

Claude's [display-mode guide](https://claude.com/docs/connectors/building/mcp-apps/display-modes) reports both the side panel and full screen as `fullscreen`; there is no `sidebar` mode. Its optional resource-content metadata `_meta.ui.preferredDisplayMode = "fullscreen"` requests the side panel. Actual placement remains host-controlled. Size from `containerDimensions` and respect `safeAreaInsets`; handle widths down to 320px. Preserve inline support and the existing user-triggered expand control where offered.

Claude's [entry-point guide](https://claude.com/docs/connectors/building/mcp-apps/entry-points) uses tool metadata `_meta["openai/ui"].entrypoints = [{ "type": "global" }]`, alongside `_meta.ui.resourceUri`. The marked tool must work with empty arguments. Eligible users can open it from Artifacts and pin it. Entry points require an eligible organization and a remote custom or Verified connector; Community installations do not expose them.

Proposed OPF implementation: add a small `open_studio` entry tool sharing the existing viewer resource, with a useful blank/sample/import starting state. Keep `show_deck`'s document contract. Show a clear document name and editing state, using the requested full-row rename/Save/Cancel behavior. Test empty arguments without relying on previous conversation content. Do not infer the owner's listing details or change account settings to force eligibility.

## W08-C: finish downloads, messages and instance behavior

The [download guide](https://claude.com/docs/connectors/building/mcp-apps/download-files) requires host-mediated exports, one pending request per view and capability checks. Resource filenames use literal spaces; percent-encoding is not decoded. A successful result means the download started. A rejected promise may leave an active dialog, so timeout wording must not claim nothing was saved. The current OPF `saveFile` uses `encodeURIComponent(name)` and needs a focused compatibility correction and real filename check.

The [message guide](https://claude.com/docs/connectors/building/mcp-apps/send-messages) requires handling both `isError` and rejection. A result without error does not prove the user agreed or Claude read the message. Review current `sendToClaude`, which ignores the returned result and sets `sent`. Keep automatic model-context sharing separate from a user-triggered request to continue; use accurate pending/accepted/unknown wording.

The [instance guide](https://claude.com/docs/connectors/building/mcp-apps/instance-supersession) explains that earlier iframes remain active. Scope any supersession to the same deck/editing session, not all presentations. Fixed `ui.domain` can share an origin across conversations, so a connector-wide BroadcastChannel is insufficient. Do not order instances by remount time. Preserve independent decks and block stale context/message/mutation calls; review the design against OPF's stateless hosted endpoint before implementation.

## Embedded pptx.dev: evaluate separately

Claude also documents [embedded websites](https://claude.com/docs/connectors/building/mcp-apps/embedded-sites). This could expose the full pptx.dev workspace through the app. It requires explicit `frameDomains`, compatible framing headers and host/listing eligibility; local servers and Community listings cannot provide it. Record whether this route adds useful capability beyond the existing bundled editor. Keep it a separately reviewed integration with a fallback when unavailable. Do not relax the bundled viewer's CSP or replace it wholesale as part of the initial adoption.

## Implementation and acceptance for the successor

1. Read this addendum with the existing full takeover prompt. Fold the accepted changes into the current v0.34 source with normal review, a changelog fragment and an updated W08 status. Preserve all unrelated native/browser/release blockers.
2. Extend the maintained browser stand-in host with meaningful supported/unsupported controls: in-place edit after a manual edit, undo/redo, stale-revision refusal, rejected/read-only calls, correct instance targeting, teardown, resize/320px and missing capabilities. Test actual generated files and names, plus message/download refusal and unknown outcomes.
3. Run the appropriate mapped checks, app types, MCP protocol/browser/Worker checks and source-budget checks. Keep the existing strict sandbox and assertion strength. Recheck final operative inputs before carrying earlier qualification forward; docs-only results do not qualify the new runtime.
4. Verify through a real remote custom connector in Claude web: first open the app, then request an edit in a second message; confirm the already-open editor changes without losing the manual edit. Check direct launch, resizing, two independent decks and downloads. Record account capability availability as observed; distinguish a rollout limitation from an implementation failure. Preserve local/other-host fallbacks.
5. Deliver through the existing trusted v0.34 release and genuine-registry site rollout. Retest the deployed hosted MCP resource/tool metadata and viewer. Listing eligibility and owner-supplied listing fields remain separate decisions; never claim a Verified listing, side-panel availability or app-tools access for everyone from a single test account.

Status: **ACCEPTED SCOPE / UNIMPLEMENTED / NOT CLIENT-QUALIFIED**. The original frozen source and all dated test results retain their original identities.
