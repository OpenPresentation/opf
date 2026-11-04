# openpresentation.org ideal customer profiles

Status: **Proposed, for Michael's approval** (2026-11-04). Three ICPs in priority order. They are
implementers and adopters of an open format, not buyers of a product: nobody pays the project, so
"adopt" means they choose OPF, build on it and tell others. The story we tell them is
[`brand-story.md`](brand-story.md). Nothing here is measured yet; validate it with issues,
discussions, npm data and interviews with people who have shipped OPF support.

Each ICP names the role and the moment, the job, what goes wrong today, how they want to work and
what makes them adopt.

## ICP 1: AI agent developers who need a format models can read and write

| | |
| --- | --- |
| **Role** | An engineer or applied-AI lead building an agent, copilot feature or generation pipeline that produces or edits decks; at an AI lab, a developer-tools company, a SaaS team adding "make a deck", or an open-source agent framework |
| **The moment** | Their first prototype wrote PPTX through a library or asked a model for python-pptx code, and the output broke: overflowing text, invalid files, charts that lost their data, edits that clobbered the whole deck |
| **Job** | Let a model write a deck as structured output, check it, show it and hand it to a person as an editable file; then let the model revise one slide without rewriting the rest |
| **What goes wrong today** | PPTX is too large and too implicit for a model to write reliably; there is no schema to constrain output; errors surface only when someone opens the file; converters and renderers disagree; every vendor API is a lock-in |
| **How they want to work** | A JSON Schema they can pass to structured outputs; a compact format card that fits a context window; a validator whose findings a model can act on (rule id, JSON Pointer path, fix); patch and diff so an agent edits by id; an MCP server and `llms.txt` so the agent can learn the format itself; local rendering to check the result |
| **What makes them adopt** | A model produces a valid deck on the first or second try with the schema in the prompt; the validator's findings close the loop; the same file renders, exports to PPTX and opens in an editor with no account; MIT license |
| **Entry points** | `/agents`, the format card, `/schema/opf/v1`, the structured-output guides (OpenAI, Claude, Google AI Studio, Vercel AI SDK), `/mcp`, the agent skills |
| **Where to find them** | Agent framework communities, MCP directories, AI engineering conferences and newsletters, GitHub issues on deck-generation projects |
| **Success measure** | Agents and frameworks that ship OPF output; MCP server connections; structured-output guide traffic; issues filed by agent builders |

## ICP 2: Tool builders who read, write, render or convert decks

| | |
| --- | --- |
| **Role** | A developer or maintainer of an editor, viewer, converter, CMS or LMS plugin, report generator, notebook extension or design tool; open-source maintainer or product engineer |
| **The moment** | A user asks for "export to slides" or "import my deck", and the team faces months of Office Open XML, or a converter that loses notes, charts and layout on every round trip |
| **Job** | Support decks as a first-class file in their tool: open, edit, save, render, import and export, with predictable results in other tools |
| **What goes wrong today** | No neutral deck format to target; PPTX semantics are implicit and vendor-specific; every pair of tools needs its own converter; no shared test corpus, so nobody can say what "supported" means |
| **How they want to work** | A versioned spec with every object and field documented; schemas they can vendor and pin; reference implementations to compare against (render, PPTX, editor); a conformance corpus with expected results; a changelog that says what broke; a public way to propose changes and get an answer |
| **What makes them adopt** | They can implement a reader from the spec in days; the reference packages are MIT and embeddable; schema changes are announced and versioned; they can claim conformance in a way their users recognize; their extensions survive in `extensions` |
| **Entry points** | `/spec`, `/spec/objects/*`, `/spec/schemas/*`, `/docs`, `/packages`, `/editor` (playground), the GitHub repository and change process |
| **Where to find them** | Open-source document and publishing tool communities, Markdown-slides projects, edtech and CMS plugin ecosystems, JSON Schema community |
| **Success measure** | Independent implementations listed on the site; conformance claims; pull requests and change proposals from outside the stewards |

## ICP 3: Enterprises that want their decks to outlive any vendor

| | |
| --- | --- |
| **Role** | An enterprise architect, head of document or records management, platform lead or procurement and standards reviewer; in regulated industries, government, education and large companies with deck archives |
| **The moment** | A tool consolidation, an AI policy review, a records-retention audit, or a vendor contract renewal makes them ask what happens to ten years of decks if the vendor or the format changes |
| **Job** | Choose a deck format the organization can store, search, audit, generate and migrate on its own terms, and require it of the tools they buy |
| **What goes wrong today** | Decks are opaque binaries tied to one suite; search and audit need the vendor's tools; AI tools each invent a format; migrations are lossy and expensive; nobody can show who governs the format |
| **How they want to work** | A specification with a stable identifier and a written versioning promise; open governance with a public record of decisions; a permissive license and no required hosted service; conformance tests they can put in an RFP; more than one implementation; a long-term home for the standard |
| **What makes them adopt** | Governance they can trust (written, public, not controlled by one vendor), a 1.0 contract, a conformance suite, independent implementations, and a lossless path from their existing PPTX archive |
| **Entry points** | `/` (what OPF is), the governance and versioning pages, `/spec/{version}`, the changelog, the implementations list |
| **Where to find them** | Enterprise architecture and records-management communities, open-standards bodies, public-sector digital teams, procurement guidance |
| **Success measure** | RFPs and policies that name OPF; enterprise contributors to the change process; requests for a governance or foundation path |

## Not our ICP (for now)

- People who make one deck at a time: they use a presentation app; whether it speaks OPF is the
  app's business.
- Designers looking for a canvas tool.
- Buyers of a hosted API or a business app: implementations serve them, the standard does not.

## What these ICPs ask of the project

Gaps the ICPs expose, for the roadmap (not promises):

1. A conformance suite and a way to state conformance (ICP 2, ICP 3).
2. A written governance document and a public decision log for spec changes (ICP 3).
3. Versioned spec and schema pages at stable URLs (`/spec/{version}`; frozen schemas exist at
   `/schema/<name>/<version>` on the site) (ICP 2, ICP 3).
4. An implementations list with neutral entries (all three).
5. The 1.0 contract (all three).
