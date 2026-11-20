# Connector submission kit for v0.34.0

Reconstructed on 2026-11-10 from the owner's handoff, current repository source and eight anonymous public reads. The earlier `connector-submission-kit.md` and its five draft screenshots were not recovered; this is replacement text, not a recovered original. Nothing has been submitted or installed.

The owner chose to keep the two-release plan: deliver this work in **0.34.0**, with **no 0.33.1**. Release/native/registry gates remain prerequisites. The public server still reported 0.33.0 during this audit; do not advertise the new viewer as live yet.

## Ready-to-copy listing fields

| Field | Draft or verified value | Confirmation needed |
| --- | --- | --- |
| Display name | OpenPresentation (OPF) | Owner approves final brand spelling. |
| Short description | Create, check and edit presentations in Open Presentation Format, with an interactive slide viewer in compatible MCP Apps clients. | Confirm against the final deployed 0.34 release. |
| MCP endpoint | `https://www.openpresentation.org/mcp` | Verify final deployment and the directory's current field requirements. |
| Transport | Streamable HTTP; stateless POST requests | No standalone SSE GET stream. |
| Authentication | No authentication on the current public endpoint | Recheck before submission; no credentials are requested by this kit. |
| Documentation | <https://www.openpresentation.org/docs/mcp> | Public route returned 200 in this audit. |
| Privacy | <https://www.openpresentation.org/privacy> | Owner reviews the policy and operational logging settings. |
| Source and issue support | <https://github.com/OpenPresentation/opf> and <https://github.com/OpenPresentation/opf/issues> | Owner confirms these are the intended support channels. No support email or response-time promise is invented. |
| Slug | `opf` (proposed) | Availability and owner approval remain open. |
| Categories | Presentations / productivity (draft descriptions) | Owner selects actual directory categories; these are not asserted directory enum values. |
| Legal publisher/company | Owner to supply | Do not infer a registered entity from the project name. |
| Contact, terms and additional legal URLs | Owner to supply if required | No fabricated email, address, company or terms URL. |

### Longer description

OpenPresentation helps an assistant create and validate presentations as editable OPF documents. It provides format guidance, schema lookup, catalog records, examples, icons and shapes. In a compatible MCP Apps client, `show_deck` opens an interactive viewer with slide previews and source editing. Edits return the complete deck to the assistant's context; Send to Claude requests a new turn.

The 0.34 release candidate adds the redesigned viewer and a host-mediated Export menu for PowerPoint, PDF and PNG. Export is available only when the host advertises file saving. Source downloads preserve the current source text and format. Unsupported hosts, denials, cancellation and protocol errors must remain visible; the viewer does not bypass the host with an iframe download fallback. Repository sandbox tests support those behaviors; actual Claude client qualification and the production 0.34 checks are still required before listing them as verified client behavior.

PPTX text is normally editable one measured line at a time. Fonts are named, not embedded in PPTX, so the receiving application may substitute fonts. Optional native paragraph behavior and native chart fidelity have separate limits and qualification; this listing makes no universal PowerPoint, font or pixel-parity claim.

### Suggested first prompt

> Make a six-slide project update with a summary, milestones, risks and next steps. Use OPF guidance and catalog records, validate the complete deck, then show it in the viewer. Keep the editable source available. If this client can save files, offer PowerPoint, PDF and PNG export.

## Data handling wording for owner review

The public MCP server receives tool arguments, which can include presentation text. Current site source processes these per request in memory and has no application deck store or cookie/session store. Viewer editing, checking, rendering and export run in the client; updates are shared with the host model context. Pinned font files are served through the app-only font resource/tool path.

The current public privacy page says the application does not log request bodies. Cloudflare still handles request metadata, including time, path, status and IP address. One-minute rate counters are **not** a log-retention policy. The owner must confirm actual provider log settings and retention before submitting any retention answer. Do not claim zero retention, absence of all processing, or a legal/compliance certification.

The public endpoint currently lists 11 model-facing tools plus app-only `read_font_file`. The 11 viewer scenarios in [coverage.md](coverage.md) are a separate count. Final 0.34 inventories must come from the deployed release, not this dated list.

## Screenshot and real-client checklist

The prior five draft images are absent. Capture replacement public/synthetic examples **after** the final 0.34 deployment in the actual supported client; retain source, client version, viewport, deployment identity and original image bytes. Suggested five frames:

1. Preview with a readable slide and reachable toolbar.
2. Both view with source and preview, including a narrow chat column.
3. A visible edit, Undo/Redo and Send to Claude/context behavior.
4. Export menu and one real host-saved PowerPoint/PDF/PNG result per format.
5. A clear refusal or error state, including an incapable/denying host when available.

Use the directory's current screenshot requirements at submission time (the old attachment suggested 3–5 images at least 1000 px wide). Existing sandbox images are developer evidence, not screenshots of a verified Claude save. Do not publish owner documents or private host metadata.

## Ordered owner handoff

1. Finish the release gates, merge the reviewed source and publish 0.34 through the trusted Release workflow. No patch-release detour.
2. Adopt the genuine packages on the three sites using [site-adoption.md](site-adoption.md); qualify the exact immutable previews and canonical deployments.
3. Execute the 11 viewer checks and real-client save/error checks in [coverage.md](coverage.md), then collect listing images and confirm the unknown fields above.
4. The owner opens <https://claude.ai/directory/manage> and submits the remote connector. No login, connector installation or submission has been performed here; directory acceptance is external.
5. Preserve RR-107/A7: attach `opf-0.34.0.mcpb` and `opf-0.34.0.mcpb.sha256` through the maintained trusted publisher after registry verification. Verify the actual pair before adding download links. Remote connector submission does not replace the desktop bundle.

The original November 7 E3 before/after refresh is also still owed after 0.34 and its private-input E1 gate. Neither that work nor the owner's desktop checksum requirement is removed by this kit.
