# Node 24 furniture continuation

This local checkpoint resumes the four September 10 furniture drafts on current
Node 24 defaults. `summary.json` binds the four committed source heads, candidate
tarballs, installed lock, shipped files and browser inputs. Package versions and
the accepted timeline raster baseline are unchanged.

The original five-case reimport probe in `reimport/` failed eleven semantic
checks. `reimport-candidate/` passes the same five fixture cases. Dedicated
furniture tags now recover exact literal whitespace/dates, current pictures and
alt text, section/organization values, valid page-number intent, and explicit
false/empty overrides. Tags store topology, identity and source separators, not
old words or image content. Uncertain groups remain ordinary current content;
inherited definitions become global only with complete coverage and agreement.

Validation on Node 24.21.0:

- Core: 507 tests, composition/pagination/data/rich-text/list controls and the
  cross-package pagination case pass. Lint exits successfully with existing
  warnings/informational diagnostics retained in the log.
- PPTX: the full package suite, code/metric/font controls and sixteen accepted
  furniture export cases pass. The furniture provenance suite passes 37 imports,
  including twelve damaged-tag controls, edits/clearing/reordering, current image
  changes and metadata disagreements. The same 37 cases pass through the clean
  installed consumer.
- Sixteen source and sixteen installed offline browser cases pass actual source
  editing, no-op, undo/redo, literal-date editing, export and semantic reimport.
  All 220 installed bundle inputs resolve within the consumer. Its lock and
  staged distributables were checked against the installed files and current
  source; package manifests intentionally carry local preview versions.
- Four full-size source screenshots were viewed and match the installed PNG
  hashes. They establish bounded controls only. The 32px portrait organization
  still wraps heavily; this is not approval of the full visual corpus.

Failures remain in place: the original semantic probe, the offline pnpm invocation,
the browser verifier's initial duplicate-variable syntax error, and macOS's
sandbox-denied Chromium launch. The subsequent authorized headless run passed.
The first provenance implementation also missed a disabled-only slide because
core omitted its furniture geometry; the exporter now writes the slide manifest
even when no visible furniture exists. This intermediate failure was observed in
the task output before the candidate report was regenerated.

Outstanding gates are the 657 changed corpus slides, final coordinated CI,
native Office/font compatibility and release/deployment acceptance. The latest
Windows handoff remains [the Node 24 native follow-up](https://github.com/OpenPresentation/opf/pull/71#issuecomment-5627652201):
Office recovery/user review is required before further native automation. No
Office calls, font licensing changes, registry publications or baseline updates
were performed here.

The user then prioritized making the public homepage's existing JSON panel
editable with live preview and unchanged styling. That work uses a separate
`codex/homepage-live-json-20260914` branch in `openpresentation-site`; these
unpublished furniture packages are not required for the homepage change.
