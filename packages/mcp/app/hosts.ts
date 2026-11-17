/**
 * The product a host names itself as, from what it sent in ui/initialize (`hostInfo`, an MCP `Implementation`: `name` is its
 * identifier, `title` its display name). The view names the product in its own words ("Send to ChatGPT", "Claude has your edits");
 * an unknown host is "the assistant". The words follow the name only; what the view does follows the capabilities the host announced.
 */
export function hostProduct(info: { name?: unknown; title?: unknown } | undefined): "Claude" | "ChatGPT" | undefined {
	const said = [info?.name, info?.title].filter((value): value is string => typeof value === "string").join(" ");
	if (/claude/i.test(said)) return "Claude";
	if (/chat[\s_-]*gpt|openai/i.test(said)) return "ChatGPT";
	return undefined;
}

/** What the host reported, for a person to read (the More menu, the footer's version): its name, title and version as sent. */
export function hostReport(info: { name?: unknown; title?: unknown; version?: unknown } | undefined): string {
	if (!info) return "The host sent no name.";
	const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 60) : undefined);
	const name = text(info.name) ?? "(no name)";
	const title = text(info.title);
	const version = text(info.version);
	return `Host: ${name}${title && title !== name ? ` (${title})` : ""}${version ? ` ${version}` : ""}`;
}
