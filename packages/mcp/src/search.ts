// A small ranked text search over the bundled documents (`search_docs`). Pure: no I/O, no Node APIs, so it runs on an edge runtime.
// Ranking: a term in the title, a term in a heading, then how often it occurs (capped, so a long page does not win by length); a page
// that has every term outranks one that has some. The snippet is the text around the rarest matching term, with the heading it sits under.

export interface SearchPage {
	uri: string;
	kind: "doc" | "skill";
	title: string;
	text: string;
}

export interface SearchHit {
	uri: string;
	kind: "doc" | "skill";
	title: string;
	/** The nearest heading above the snippet, when there is one. */
	heading?: string;
	score: number;
	snippet: string;
}

interface Indexed extends SearchPage {
	lower: string;
	titleLower: string;
	headings: { at: number; text: string; lower: string }[];
}

export const termsOf = (query: string): string[] => [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}_$@:-]+/u).filter((term) => term.length > 0))];

function index(page: SearchPage): Indexed {
	const headings: Indexed["headings"] = [];
	const heading = /^#{1,6}[ \t]+(.+?)[ \t#]*$/gm;
	for (let found = heading.exec(page.text); found; found = heading.exec(page.text)) headings.push({ at: found.index, text: found[1] as string, lower: (found[1] as string).toLowerCase() });
	return { ...page, lower: page.text.toLowerCase(), titleLower: page.title.toLowerCase(), headings };
}

function occurrences(haystack: string, term: string, cap: number): { count: number; first: number } {
	let count = 0;
	let first = -1;
	for (let at = haystack.indexOf(term); at !== -1 && count < cap; at = haystack.indexOf(term, at + term.length)) {
		if (first === -1) first = at;
		count++;
	}
	return { count, first };
}

function snippetAt(page: Indexed, at: number, length: number): { snippet: string; heading?: string } {
	const from = Math.max(0, at - 90);
	const to = Math.min(page.text.length, at + length + 140);
	let text = page.text.slice(from, to).replace(/\s+/g, " ").trim();
	if (from > 0) text = `... ${text.replace(/^\S*\s/, "")}`;
	if (to < page.text.length) text = `${text.replace(/\s\S*$/, "")} ...`;
	let heading: string | undefined;
	for (const candidate of page.headings) {
		if (candidate.at > at) break;
		heading = candidate.text;
	}
	return { snippet: text, ...(heading ? { heading } : {}) };
}

/** A search over `pages`; build it once, call it for each query. */
export function createSearch(pages: readonly SearchPage[]): (query: string, limit: number) => { total: number; hits: SearchHit[] } {
	let indexed: Indexed[] | undefined;
	return (query, limit) => {
		indexed ??= pages.map(index);
		const terms = termsOf(query);
		if (!terms.length) return { total: 0, hits: [] };
		const hits: SearchHit[] = [];
		for (const page of indexed) {
			let score = 0;
			let matched = 0;
			let rarest: { term: string; count: number; first: number } | undefined;
			for (const term of terms) {
				const body = occurrences(page.lower, term, 40);
				const inTitle = page.titleLower.includes(term);
				const inHeadings = page.headings.filter((heading) => heading.lower.includes(term)).length;
				if (!body.count && !inTitle) continue;
				matched++;
				score += (inTitle ? 12 : 0) + Math.min(inHeadings, 3) * 4 + Math.min(body.count, 12);
				if (body.count && (!rarest || body.count < rarest.count)) rarest = { term, count: body.count, first: body.first };
			}
			if (!matched) continue;
			score *= (matched / terms.length) ** 2;
			// A skill entrypoint is a summary of its area, so it ranks a little above the page with the same text.
			if (page.kind === "skill") score *= 1.1;
			const where = snippetAt(page, rarest?.first ?? 0, rarest?.term.length ?? 0);
			hits.push({ uri: page.uri, kind: page.kind, title: page.title, ...(where.heading ? { heading: where.heading } : {}), score: Math.round(score * 10) / 10, snippet: where.snippet });
		}
		hits.sort((a, b) => b.score - a.score || a.uri.localeCompare(b.uri));
		return { total: hits.length, hits: hits.slice(0, limit) };
	};
}
