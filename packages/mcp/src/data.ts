// The data the OPF MCP server serves, bundled at build time and never read from disk: the user-facing documentation pages and the
// example decks come from core's generated modules (`@openpresentation/opf/docs`, `/examples`, built from docs/ and examples/),
// the skill entrypoints and their references from the `OPF_MCP_SKILLS` constant, and the recent release notes from `OPF_MCP_WHATS_NEW`,
// both inlined by tsup from skills/ and CHANGELOG.md (see tsup.config.ts).
import { docs } from "@openpresentation/opf/docs";
import { examples } from "@openpresentation/opf/examples";
import type { DocPage, ExamplePage, OpfMcpSources } from "./server.js";

declare const OPF_MCP_SKILLS: Record<string, Record<string, string>>;
declare const OPF_MCP_WHATS_NEW: string;

/**
 * The documentation pages for people and agents who use OPF, by slug. Core bundles every top-level page of docs/; this list leaves
 * out what is for the maintainers: handoffs, evidence, status and backlog notes, security and release runbooks, the compatibility
 * matrix. A new page is listed here on purpose (the test checks every slug exists and that no dated or handoff page is listed).
 */
export const DOC_SLUGS: readonly string[] = [
	"format-card",
	"how-opf-works",
	"quickstart",
	"llm-authoring",
	"agent-skills",
	"mcp",
	"schema-reference",
	"validate",
	"finding-schema-reference",
	"content-payloads",
	"content-item-design-overrides",
	"design-resolution",
	"dynamic-composition",
	"layout-templates",
	"slide-sizes",
	"slide-design-principles",
	"rich-text",
	"numbered-lists",
	"table-text-colors",
	"image-treatments",
	"chart-options",
	"chart-table-data",
	"footnotes-citations-captions",
	"templates-and-variables",
	"data-import",
	"catalog-schema-reference",
	"default-catalog",
	"examples",
	"stats",
	"markdown",
	"yaml",
	"conversions",
	"patch-diff-merge-format",
	"node",
	"cli",
	"live-editor",
	"open-ecosystem",
];

/** The bundled sources. Pass `{ ...defaultSources(), examples: [] }` to a host that must stay small. */
export function defaultSources(): OpfMcpSources {
	const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
	return {
		docs: DOC_SLUGS.flatMap((slug): DocPage[] => {
			const doc = bySlug.get(slug);
			return doc ? [{ slug: doc.slug, title: doc.title, markdown: doc.markdown }] : [];
		}),
		examples: examples.map((example): ExamplePage => ({ slug: example.slug, category: example.category, gallery: example.gallery, file: example.file, deck: example.deck })),
		skills: OPF_MCP_SKILLS,
		whatsNew: OPF_MCP_WHATS_NEW,
	};
}
