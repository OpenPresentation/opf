// The OPF deck view: the MCP App that `show_deck` opens (ui://opf/deck). It runs in the host's sandboxed iframe and does the deck's
// work there, on the user's machine: the editor session, the source pane, the slide renderer and the checks are the OPF packages
// themselves (@openpresentation/opf-editor, opf-render and the precompiled validators of @openpresentation/opf). The server only
// hands over this page and, when a deck needs them, font files. The sandbox allows no network, no eval and no WASM; the build
// (scripts/build-app.mjs) bundles everything into one HTML file and picks the precompiled validators.
//
// The loop: the host sends the tool's arguments (the deck), the view mounts the editor and shows Preview, Source or Both. Every
// edit is applied, checked and redrawn here; one second after the last edit the whole deck goes to the model as context
// (ui/update-model-context), and "Send to Claude" also starts a turn (ui/message).
import { App, type McpUiDisplayMode, type McpUiHostContext, applyDocumentTheme, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { gallery } from "@openpresentation/gallery";
import { type Finding, validate } from "@openpresentation/opf";
import { createOpfEditor, layoutOptionsFor, type OpfEditor } from "@openpresentation/opf-editor/workspace";
import { type BrowserFontsHandle, loadFonts } from "@openpresentation/opf-render/fonts-browser";
import { FONT_BASE, bytesOf, extraFaces, fontFetch, startupFaces } from "./fonts.js";

declare const MCP_VERSION: string;

type View = "preview" | "source" | "both";
type Format = "json" | "yaml" | "markdown";
interface ShowDeckArguments {
	document?: unknown;
	format?: Format;
	view?: View;
	slide?: number;
}

const VIEWS: readonly View[] = ["preview", "source", "both"];
const CONTEXT_DELAY = 1000;
const CHECK_DELAY = 400;
const MAX_LISTED_FINDINGS = 20;
const catalogs = [gallery];

const root = document.documentElement;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const shell = $("opf-deck");
const notice = $("deck-notice");
const findButton = $<HTMLButtonElement>("deck-find-open");
const reviewDrawer = $("deck-review");
const reviewClose = $<HTMLButtonElement>("deck-review-close");
const sendButton = $<HTMLButtonElement>("deck-send");
const expandButton = $<HTMLButtonElement>("deck-expand");
const tabs = VIEWS.map((view) => $<HTMLButtonElement>(`tab-${view}`));

const app = new App({ name: "OPF deck view", version: MCP_VERSION }, { availableDisplayModes: ["inline", "fullscreen"] });

let editor: OpfEditor | undefined;
let fonts: BrowserFontsHandle | undefined;
let context: McpUiHostContext = {};
let view: View = "preview";
let edited = false;
let unsent = false;
let counts = { error: 0, warning: 0, info: 0 };
let findings: Finding[] = [];
let contextTimer: ReturnType<typeof setTimeout> | undefined;
let checkTimer: ReturnType<typeof setTimeout> | undefined;
let started = false;

// -------------------------------------------------------------------------------------------------------------------
// Fonts: Roboto Regular is in the page; any other face comes from the server through the host (read_font_file).

const readFontFile = async (file: string): Promise<Uint8Array> => {
	// The server sends a file in pieces; ask for the next one until the whole file is here.
	const pieces: Uint8Array[] = [];
	let offset = 0;
	let total = Number.POSITIVE_INFINITY;
	while (offset < total) {
		const result = await app.callServerTool({ name: "read_font_file", arguments: { file, offset } });
		const piece = result.structuredContent as { bytes?: unknown; total?: unknown; offset?: unknown } | undefined;
		if (result.isError || typeof piece?.bytes !== "string" || typeof piece.total !== "number") {
			const text = result.content?.find((part) => part.type === "text");
			throw new Error(text && "text" in text ? String(text.text) : `The server sent no font file for ${file}.`);
		}
		const bytes = bytesOf(piece.bytes);
		if (!bytes.length && offset < piece.total) throw new Error(`The server sent an empty piece of ${file}.`);
		pieces.push(bytes);
		offset += bytes.length;
		total = piece.total;
	}
	const whole = new Uint8Array(offset);
	let at = 0;
	for (const piece of pieces) {
		whole.set(piece, at);
		at += piece.length;
	}
	return whole;
};

const fontsReady: Promise<BrowserFontsHandle> = loadFonts({
	faces: startupFaces(),
	substitutionPolicy: "visual",
	fallbackFamily: "Roboto",
	fetch: fontFetch(readFontFile),
	lazyFontsBaseUrl: FONT_BASE,
	scriptBaseUrl: `${FONT_BASE}script-fonts/`,
	extraLazyFonts: extraFaces(),
	renderOptions: { catalogs },
});

// -------------------------------------------------------------------------------------------------------------------
// Checks: core's validators over the document, with text measured by the same fonts the slides draw with.

function runChecks(deck: unknown): void {
	try {
		const textMeasurement = fonts ? (slide: number) => layoutOptionsFor(fonts as never, deck, slide, catalogs).fonts?.textMeasurement : undefined;
		const report = validate(deck as never, { catalogs, ...(textMeasurement ? { fonts: { textMeasurement } as never } : {}) });
		findings = report.findings;
	} catch {
		// A measurement that cannot run yet (a face still loading): the estimate is close enough until the next edit.
		findings = validate(deck as never, { catalogs }).findings;
	}
	counts = { error: 0, warning: 0, info: 0 };
	for (const finding of findings) counts[finding.severity] += 1;
}

const scheduleChecks = (deck: unknown) => {
	clearTimeout(checkTimer);
	checkTimer = setTimeout(() => runChecks(deck), CHECK_DELAY);
};

// -------------------------------------------------------------------------------------------------------------------
// What the model hears: the whole deck after the user's edits (it keeps editing from it), and the checks either way.

const findingLines = () =>
	findings
		.filter((finding) => finding.severity !== "info")
		.slice(0, MAX_LISTED_FINDINGS)
		.map((finding) => `- ${finding.severity} ${finding.ruleId} at ${finding.path || "/"}: ${finding.message}`);

function contextText(): string {
	const deck = editor?.getDocument();
	const slides = Array.isArray((deck as { slides?: unknown[] } | undefined)?.slides) ? (deck as { slides: unknown[] }).slides.length : 0;
	const at = editor ? editor.slideIndex + 1 : 1;
	const checks = `Checks in the viewer: ${counts.error} errors, ${counts.warning} warnings, ${counts.info} notes.${findingLines().length ? `\n${findingLines().join("\n")}` : ""}`;
	if (!edited) return `The OPF viewer shows the deck you sent (${slides} slides, slide ${at} open, ${view} view). ${checks}`;
	return `The user edited the deck in the OPF viewer (${slides} slides, slide ${at} open). Continue from this version, not the one you sent. ${checks}\n\nThe current deck:\n\`\`\`json\n${JSON.stringify(deck, null, 2)}\n\`\`\``;
}

async function sendContext(): Promise<void> {
	clearTimeout(contextTimer);
	contextTimer = undefined;
	if (!editor || !app.getHostCapabilities()?.updateModelContext) return;
	const deck = editor.getDocument();
	try {
		await app.updateModelContext({ content: [{ type: "text", text: contextText() }], structuredContent: { edited, counts, findings: findings.slice(0, MAX_LISTED_FINDINGS), ...(edited ? { document: deck as Record<string, unknown> } : {}) } });
	} catch (error) {
		status(`Claude did not take the update: ${error instanceof Error ? error.message : String(error)}`);
	}
}

const scheduleContext = () => {
	clearTimeout(contextTimer);
	contextTimer = setTimeout(() => void sendContext(), CONTEXT_DELAY);
};

async function sendToClaude(): Promise<void> {
	if (!editor) return;
	sendButton.disabled = true;
	try {
		if (checkTimer) {
			clearTimeout(checkTimer);
			runChecks(editor.getDocument());
		}
		await sendContext();
		const ask = edited ? "I edited the deck in the OPF viewer. Please continue from my version." : "Please look at the deck in the OPF viewer and suggest improvements.";
		await app.sendMessage({ role: "user", content: [{ type: "text", text: ask }] });
		unsent = false;
		status("Sent to Claude.");
	} catch (error) {
		status(`Could not send to Claude: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		sendButton.disabled = !unsent && edited;
	}
}

// -------------------------------------------------------------------------------------------------------------------
// Views, display mode and the host's look.

const fullscreenOffered = () => (context.availableDisplayModes ?? []).includes("fullscreen");

function setView(next: View, fromUser = false): void {
	view = next;
	shell.dataset.view = next;
	for (const [index, tab] of tabs.entries()) {
		const selected = VIEWS[index] === next;
		tab.setAttribute("aria-selected", String(selected));
		tab.tabIndex = selected ? 0 : -1;
	}
	// Side by side needs room: inline in a narrow chat, Both asks the host for fullscreen (the host may say no; then the panes stack).
	if (fromUser && next === "both" && context.displayMode !== "fullscreen" && fullscreenOffered() && shell.clientWidth < 860) void setDisplayMode("fullscreen");
}

async function setDisplayMode(mode: McpUiDisplayMode): Promise<void> {
	try {
		const result = await app.requestDisplayMode({ mode });
		applyContext({ displayMode: result.mode });
	} catch {
		// The host decides; the view works in either mode.
	}
}

function applyContext(update: Partial<McpUiHostContext>): void {
	context = { ...context, ...update };
	if (context.theme) {
		applyDocumentTheme(context.theme);
		editor?.setTheme({ colorScheme: context.theme });
	}
	if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
	root.dataset.display = context.displayMode ?? "inline";
	const dimensions = context.containerDimensions as { height?: number; maxHeight?: number } | undefined;
	root.dataset.fixedHeight = String(typeof dimensions?.height === "number");
	if (typeof dimensions?.maxHeight === "number") shell.style.setProperty("--deck-max-height", `${dimensions.maxHeight}px`);
	expandButton.hidden = !fullscreenOffered();
	expandButton.textContent = context.displayMode === "fullscreen" ? "Exit full screen" : "Full screen";
	sendButton.hidden = !app.getHostCapabilities()?.message;
}

function setReviewOpen(open: boolean): void {
	reviewDrawer.hidden = !open;
	if (open) reviewClose.focus();
	else (shell.querySelector(".opf-review-pill") as HTMLElement | null)?.focus();
}

function status(message: string): void {
	notice.textContent = message;
	notice.hidden = !message;
}

// -------------------------------------------------------------------------------------------------------------------
// Start: the tool's arguments arrive once (ui/notifications/tool-input), after the host has initialized the view.

const isText = (value: unknown): value is string => typeof value === "string";

async function start(args: ShowDeckArguments): Promise<void> {
	if (started) return;
	started = true;
	const format: Format = args.format ?? (isText(args.document) && !/^[\s﻿]*[[{]/.test(args.document) ? "yaml" : "json");
	if (args.document === undefined) {
		status("Claude sent no deck.");
		return;
	}
	status("Drawing the slides…");
	fonts = await fontsReady;
	const textForm = isText(args.document) && format !== "json";
	// Edits count from the moment the deck is on screen; the first load is not one.
	let ready = false;
	editor = createOpfEditor($("deck-root"), {
		// JSON (an object or its text) opens as the document; YAML and Markdown open as source text once the editor is ready.
		document: textForm ? { name: "Untitled", slides: [{ title: " " }] } : args.document,
		fonts,
		catalogs,
		fit: "contain",
		theme: { colorScheme: context.theme ?? "auto" },
		// The editor's own parts, each in the viewer's element: Undo and Redo, the review pill and the Review panel (in a drawer the
		// pill opens), the Design quick menu (theme, colours, fonts and this slide's layout) and Find and replace (Ctrl/Cmd F).
		slots: {
			title: $("deck-title"),
			history: $("deck-history"),
			reviewPill: $("deck-review-pill"),
			review: $("deck-review-panel"),
			designMenu: $("deck-design"),
			find: $("deck-find"),
			source: $("deck-source"),
			canvas: $("deck-canvas"),
			slide: $("deck-stage"),
			navigator: $("deck-nav"),
			thumbnails: $("deck-thumbs"),
			status: $("deck-status"),
			overlay: shell,
		},
	});
	editor.on("change", (event) => {
		if (!ready) return;
		edited = true;
		unsent = true;
		sendButton.disabled = false;
		scheduleChecks(event.document);
		scheduleContext();
	});
	editor.on("slide", () => scheduleContext());
	// The pill opens the Review panel: the editor has no side panel here, so it asks the host page (this view) to show it.
	editor.on("review-open", () => setReviewOpen(true));
	await editor.ready;
	// The source pane calls OPF Markdown "md".
	if (textForm) editor.setSourceText(args.document as string, { format: format === "markdown" ? "md" : "yaml" });
	ready = true;
	if (typeof args.slide === "number" && args.slide >= 1) editor.setSlide(args.slide - 1);
	setView(VIEWS.includes(args.view as View) ? (args.view as View) : "preview");
	status("");
	runChecks(editor.getDocument());
	await sendContext();
}

// -------------------------------------------------------------------------------------------------------------------
// Wiring.

for (const [index, tab] of tabs.entries()) {
	tab.addEventListener("click", () => setView(VIEWS[index] as View, true));
	tab.addEventListener("keydown", (event) => {
		if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
		const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length] as HTMLButtonElement;
		next.focus();
		next.click();
	});
}
findButton.addEventListener("click", () => editor?.openFind());
reviewClose.addEventListener("click", () => setReviewOpen(false));
reviewDrawer.addEventListener("keydown", (event) => {
	if (event.key === "Escape") setReviewOpen(false);
});
sendButton.addEventListener("click", () => void sendToClaude());
expandButton.addEventListener("click", () => void setDisplayMode(context.displayMode === "fullscreen" ? "inline" : "fullscreen"));

app.ontoolinputpartial = () => {
	if (!started) status("Claude is writing the deck…");
};
app.ontoolinput = (params) => void start((params.arguments ?? {}) as ShowDeckArguments).catch((error: unknown) => status(`The deck could not open: ${error instanceof Error ? error.message : String(error)}`));
app.ontoolresult = (result) => {
	if (result.isError && !started) {
		const text = result.content?.find((part) => part.type === "text");
		status(text && "text" in text ? String(text.text) : "The tool failed.");
	}
};
app.ontoolcancelled = () => {
	if (!started) status("Claude stopped before the deck was ready.");
};
app.onhostcontextchanged = (update) => applyContext(update);
app.onteardown = async () => {
	if (contextTimer) await sendContext();
	return {};
};

status("Waiting for the deck…");
setView("preview");
await app.connect();
applyContext(app.getHostContext() ?? {});
