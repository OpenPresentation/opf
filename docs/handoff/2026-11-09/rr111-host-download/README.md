# RR-111: MCP host-mediated source download

This narrow0.34 candidate fixes confirmed [issue1220](https://github.com/OpenPresentation/opf/issues/1220). The hosted0.33 evidence is frozen separately on the private Org evidence branch2186e006; no deployed0.33 HTML or site source is hotpatched here. Chart representation agreement remains pending, with no chart implementation.

Fresh main9545016583ccfa151077cda4d51043ac6505a140 was checked out with maintained `agent-worktree.mjs` and normally fast-forwarded to assigned integration6d5d61edc5c78a5c92128dd517c7dd6257d52331. Branch `codex/rr-111-mcp-host-download`, worktree `C:/opf-work/rr111-mcp`, pinned Node24.20.0/pnpm10.33.2, existing ext-apps1.7.5. No dependency, editor API, source schema, CSP, iframe sandbox, native domain, golden or provider change is needed.

## Contract and decision

Vetoable **RR111-HOST-DOWNLOAD** uses the editor's existing public `source.onDownload` callback. The callback receives the current `SourceFile`; its text and MIME are passed unchanged in an embedded resource to `App.downloadFile`, and the current suggested filename is encoded as the last segment of a `file:///` URI. This URI is download metadata, not a filesystem read or host fetch. Requests are sent only when `getHostCapabilities().downloadFile` is advertised. The installed SDK and [MCP Apps draft](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx) define this mechanism for a sandbox whose direct downloads are blocked.

Unsupported capability, host `isError` cancellation/denial and rejected protocol requests set a visible error and reject the callback. The editor therefore does not emit its successful kept event for those failures. There is no iframe Blob/anchor fallback, no sandbox relaxation and no invented saved-file notice. Host acknowledgement is qualified as an accepted host request; actual confirmation and saving remain the host's responsibility. The manual guidance is to select the Source text; the Copy button is not newly qualified or promised by this change.

## Actual tests

The maintained `packages/mcp/test/deck-app-browser.mjs` now advertises/downloads only in explicit synthetic host cases. Its cross-origin iframe and restrictive CSP remain unchanged. It observes real iframe Blob/anchor attempts without blocking or substituting them, clicks the actual Download source button, and checks the host's exact embedded resource payload.

- The unchanged production baseline fails all four new download groups with one Blob/anchor fallback each. Existing viewer/font/context/edit checks pass. This is the actual bug reproduction, not a source-string check.
- The first candidate incorrectly used the internal helper name `sourceOptions` instead of the public `source` option, so the same real regressions remained red. That entire run is retained. Correcting only the wiring key passes the actual app TypeScript configuration and all12 browser groups; assertions, sandbox and timeouts are unchanged.
- The positive case edits an actual slide body through visible CodeMirror input, checks the complete returned document, exact source text, and every painted word/interior space while allowing only line-boundary wraps. It renames the source file using reserved `#`/`%` characters and checks the encoded filename, exact current JSON and MIME in one host request. Actual body Undo/Redo restore the complete original/edited deck.
- Untouched CRLF JSON, YAML with its comment and Markdown retain exact source text and their own MIME/extensions. A host without the capability gets no download request. Denial, cancellation and protocol errors show visible failures. Every case checks zero iframe Blob/anchor fallback and zero direct browser downloads. The original views, font loading, context, editing, Undo/Redo, responsive layout and CSP checks still pass.

All browser work uses an owned synthetic localhost host and in-memory MCP server; no remote MCP RPC, Claude connector/login, provider/admin API, Office, release or rollout is performed. Representative successful edited Both and unsupported-error screenshots were inspected. Required mapped validation and final sealed evidence are recorded below after completion. Coordinator publication, combined/full/cross-platform CI and actual Claude-host qualification remain separate gates.
