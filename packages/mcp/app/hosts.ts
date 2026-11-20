/**
 * The product a host names itself as, from what it sent in ui/initialize (`hostInfo`, an MCP `Implementation`: `name` is its
 * identifier, `title` its display name). The view names the product in its own words ("Ask ChatGPT to edit…", "Claude can see this version");
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

/**
 * What the host announced that the view acts on, one short part each, from the same fields the controls read: `message` (Send),
 * `save files` (`downloadFile`: Export and Download), `full screen` (`availableDisplayModes`: Expand), `tools` (`serverTools`: fonts,
 * icons, examples) and `context` (`updateModelContext`: edits reach the model). Diagnostic text for the More menu and the footer's title.
 */
export function hostAbilities(capabilities: { message?: unknown; downloadFile?: unknown; serverTools?: unknown; updateModelContext?: unknown } | undefined, displayModes: readonly string[] | undefined): string[] {
	const said = (value: unknown) => (value ? "yes" : "no");
	return [
		`message: ${said(capabilities?.message)}`,
		`save files: ${said(capabilities?.downloadFile)}`,
		`full screen: ${said(displayModes?.includes("fullscreen"))}`,
		`tools: ${said(capabilities?.serverTools)}`,
		`context: ${said(capabilities?.updateModelContext)}`,
	];
}
