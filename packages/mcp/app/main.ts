// The OPF deck view: the MCP App that `show_deck` opens (ui://opf/deck). It runs in the host's sandboxed iframe and does the deck's
// work there, on the user's machine: the editor session, the source pane, the slide renderer and the checks are the OPF packages
// themselves (@openpresentation/opf-editor, opf-render and the precompiled validators of @openpresentation/opf). The server only
// hands over this page and, when a deck needs them, font files. The sandbox allows no network, no eval and no WASM; the build
// (scripts/build-app.mjs) bundles everything into one HTML file and picks the precompiled validators.
//
// The loop: the host sends the tool's arguments (the deck), the view mounts the editor and shows Preview, Source or Both. Every
// edit is applied, checked and redrawn here; one second after the last edit the whole deck goes to the model as context
// (ui/update-model-context), and "Send to Claude" also starts a turn (ui/message).
//
// The look is the openpresentation.org design system's playground bar (a 48px bar, a 28px status footer; view.css) in one
// palette: the viewer's own chrome and the editor's parts read the same `--opf-ui-*` tokens, mapped onto the host's colours.
import { App, type McpUiDisplayMode, type McpUiHostContext, applyDocumentTheme, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { gallery } from "@openpresentation/gallery";
import { type Finding, embed, validate } from "@openpresentation/opf";
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
const wait = $("deck-wait-text");
const sync = $("deck-sync");
const undoButton = $<HTMLButtonElement>("deck-undo");
const redoButton = $<HTMLButtonElement>("deck-redo");
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
let mounted = false;
let themed: string[] = [];

/** What the person calls the model on the other side: Claude in Claude, "the assistant" in another MCP Apps host. */
const assistant = () => (/claude/i.test(app.getHostVersion()?.name ?? "") ? "Claude" : "the assistant");
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

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
		// Edits made while this update was on its way wait for the next one.
		if (edited && !contextTimer && sync.dataset.state === "pending") setSync("shared");
	} catch (error) {
		status(`${sentence(assistant())} did not take the update: ${error instanceof Error ? error.message : String(error)}`);
	}
}

// What the person sees of that: their edits reach the model without a click, and the footer says where they are.
function setSync(state: "none" | "pending" | "shared" | "sent"): void {
	sync.dataset.state = state;
	sync.textContent = state === "pending" ? "Edits not shared yet" : state === "shared" ? `${sentence(assistant())} has your edits` : state === "sent" ? `Sent to ${assistant()}` : "";
}

/** Send is the view's one primary action, and only while there are edits the model has not been asked about. */
function syncSend(): void {
	sendButton.textContent = `Send to ${assistant()}`;
	sendButton.disabled = !unsent;
	sendButton.dataset.unsent = String(unsent);
	sendButton.title = unsent ? `Ask ${assistant()} to continue from your version` : `Edit the deck, then send your version to ${assistant()}`;
}

const scheduleContext = () => {
	clearTimeout(contextTimer);
	contextTimer = setTimeout(() => void sendContext(), CONTEXT_DELAY);
};

async function sendToClaude(): Promise<void> {
	if (!editor || !unsent) return;
	sendButton.disabled = true;
	try {
		if (checkTimer) {
			clearTimeout(checkTimer);
			runChecks(editor.getDocument());
		}
		await sendContext();
		await app.sendMessage({ role: "user", content: [{ type: "text", text: "I edited the deck in the OPF viewer. Please continue from my version." }] });
		unsent = false;
		setSync("sent");
	} catch (error) {
		status(`Could not send to ${assistant()}: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		syncSend();
	}
}

// -------------------------------------------------------------------------------------------------------------------
// Views, display mode and the host's look.

const fullscreenOffered = () => (context.availableDisplayModes ?? []).includes("fullscreen");

function setView(next: View, fromUser = false): void {
	view = next;
	shell.dataset.show = next;
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

/**
 * One palette for the whole view. The editor's tokens are OPF's (the openpresentation.org design system); in a host that sends
 * the standard MCP Apps variables, the neutral ones are derived from the host's background and text instead, so the bar, the
 * source pane and the footer sit in the host's surface rather than beside it. The accent and the status colours stay OPF's.
 */
function hostTheme(): { colorScheme: "light" | "dark" | "auto"; tokens: Record<string, string> } {
	const sent = context.styles?.variables as Record<string, string | undefined> | undefined;
	const tokens: Record<string, string> = {
		"--opf-ui-font": 'var(--font-sans, system-ui, -apple-system, "Segoe UI", sans-serif)',
		"--opf-ui-mono": "var(--font-mono, ui-monospace, Menlo, Consolas, monospace)",
	};
	if (sent?.["--color-background-primary"] && sent["--color-text-primary"]) {
		const background = "var(--color-background-primary)";
		const text = "var(--color-text-primary)";
		const mix = (percent: number) => `color-mix(in srgb, ${text} ${percent}%, ${background})`;
		Object.assign(tokens, {
			"--opf-ui-surface": background,
			"--opf-ui-bg": mix(3),
			"--opf-ui-muted": mix(9),
			"--opf-ui-muted-2": mix(5),
			"--opf-ui-fg": text,
			"--opf-ui-muted-fg": `var(--color-text-secondary, ${mix(66)})`,
			"--opf-ui-border": mix(14),
			"--opf-ui-border-strong": mix(28),
			"--opf-ui-code-bg": mix(2),
			"--opf-ui-code-border": mix(14),
			"--opf-ui-studio-canvas-bg": mix(8),
		});
	}
	return { colorScheme: context.theme ?? "auto", tokens };
}

function applyTheme(): void {
	const theme = hostTheme();
	// On the shell itself too, so the view has its colours before the editor mounts.
	for (const name of themed) shell.style.removeProperty(name);
	themed = Object.keys(theme.tokens);
	for (const [name, value] of Object.entries(theme.tokens)) shell.style.setProperty(name, value);
	editor?.setTheme(theme);
}

function applyContext(update: Partial<McpUiHostContext>): void {
	context = { ...context, ...update };
	if (context.theme) applyDocumentTheme(context.theme);
	if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
	applyTheme();
	root.dataset.display = context.displayMode ?? "inline";
	const dimensions = context.containerDimensions as { height?: number; maxHeight?: number } | undefined;
	// Inline, the view is as tall as its content; full screen and a host that fixes the height fill the frame.
	root.dataset.fill = String(context.displayMode === "fullscreen" || typeof dimensions?.height === "number");
	if (typeof dimensions?.maxHeight === "number") shell.style.setProperty("--deck-max-height", `${dimensions.maxHeight}px`);
	expandButton.hidden = !fullscreenOffered();
	const expandLabel = context.displayMode === "fullscreen" ? "Exit full screen" : "Full screen";
	expandButton.setAttribute("aria-label", expandLabel);
	expandButton.title = expandLabel;
	expandButton.dataset.mode = context.displayMode ?? "inline";
	const can = app.getHostCapabilities();
	sendButton.hidden = !can?.message;
	// The sandbox cannot save a file itself: the source pane offers Download only where the host does it (ui/download-file).
	shell.dataset.download = String(Boolean(can?.downloadFile));
	syncSend();
}

function setReviewOpen(open: boolean): void {
	reviewDrawer.hidden = !open;
	if (open) reviewClose.focus();
	else (shell.querySelector(".opf-review-pill") as HTMLElement | null)?.focus();
}

/** A message for the person: under the placeholder slide until the deck is on screen, then in the footer (the editor's status line). */
function status(message: string): void {
	if (mounted && editor) editor.status(message);
	else wait.textContent = message;
}

/** The deck will not open: the placeholder stops promising one. */
function fail(message: string): void {
	status(message);
	if (!mounted) $("deck-wait").dataset.failed = "true";
}

/** The stage in the shape of the deck's slides (16:9 until a slide is drawn). */
function showDeck(): void {
	const box = $("deck-canvas").querySelector("svg")?.viewBox.baseVal;
	if (box?.width && box.height) shell.style.setProperty("--deck-aspect", `${box.width} / ${box.height}`);
}

// -------------------------------------------------------------------------------------------------------------------
// Export: the editor's own Export menu (PowerPoint, PDF, PNG, SVG and the OPF source), made in this frame. The sandbox cannot save
// a file, so every file goes to the host (ui/download-file), and the menu is offered only where the host takes it.

/** A file for the host to save. A large one is encoded in pieces: one call with every byte as an argument overflows the stack. */
async function saveFile(name: string, type: string, data: Blob | string): Promise<void> {
	let resource: { uri: string; mimeType: string; text: string } | { uri: string; mimeType: string; blob: string };
	if (typeof data === "string") resource = { uri: `file:///${name}`, mimeType: type, text: data };
	else {
		const bytes = new Uint8Array(await data.arrayBuffer());
		let binary = "";
		for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
		resource = { uri: `file:///${name}`, mimeType: type, blob: btoa(binary) };
	}
	const saved = await app.downloadFile({ contents: [{ type: "resource", resource }] });
	if (saved.isError) throw new Error("The file was not saved.");
}

/**
 * An editable PowerPoint file from the deck, made here with @openpresentation/opf-pptx (the exporter the playground uses), with the
 * preview's fonts and catalogs so the file matches the slides. The exporter loads only when this runs. It makes no request: a
 * remote picture stays a labelled placeholder, and an SVG picture's PNG fallback is drawn by the renderer's browser rasterizer.
 */
async function exportPptx(deck: unknown, request: { signal: AbortSignal; onProgress(progress: { stage?: string; done?: number; total?: number; message?: string }): void }): Promise<{ bytes: Uint8Array; warnings: string[] }> {
	const check = () => request.signal.throwIfAborted();
	// An export is a saved copy: every record the deck references is embedded first, so the file is built from the document itself.
	const whole = embed(structuredClone(deck) as never, { catalogs }).document as unknown as { slides?: unknown[] };
	if (!Array.isArray(whole.slides) || !whole.slides.length) throw new Error("There are no slides to export.");
	request.onProgress({ stage: "fonts", done: 0, total: 1, message: "Preparing fonts…" });
	await fonts?.ensure(whole as never, { signal: request.signal, catalogs } as never);
	check();
	request.onProgress({ stage: "convert", done: 0, total: 1, message: "Building the PowerPoint file…" });
	const [{ toPptx }, { toPng }] = await Promise.all([import("@openpresentation/opf-pptx"), import("@openpresentation/opf-render/export-browser")]);
	const notes = new Set<string>();
	const png = (svg: string, options: { scale?: number; background?: string }) => toPng(svg as `<${string}`, { ...options, svgSource: "data" });
	const bytes = await toPptx(whole as never, {
		fonts,
		catalogs,
		onDiagnostic: (item: { code: string; message: string }) => {
			if (PPTX_NOTES.has(item.code)) notes.add(item.message);
		},
		// The PNG fallback of an SVG picture: at the SVG's own size, then larger when the exporter asks for more pixels.
		svgRasterizer: async (svg: string, size: { width: number }) => {
			const first = await png(svg, { background: "transparent" });
			const own = new DataView(first.buffer, first.byteOffset, first.byteLength).getUint32(16);
			return own > 0 && own < size.width ? png(svg, { scale: Math.min(8, size.width / own), background: "transparent" }) : first;
		},
	} as never);
	check();
	return { bytes: bytes as Uint8Array, warnings: [...notes] };
}
/** The exporter's notes worth showing to a person; the rest are layout bookkeeping. */
const PPTX_NOTES = new Set(["unresolved-asset", "content-placeholder", "chart-data-unplottable", "chart-data-adapted", "chart-map-geodata", "svg-sanitized", "svg-image-rasterized", "watermark-not-exported", "unresolved-reference", "media-provenance-omitted", "variable-example-used"]);

/** PNG and the raster parts of a PDF, with the slide handed to the image decoder as a data: URL (the sandbox allows no blob: image). */
const converters = {
	toPng: async (svg: unknown, options?: object) => (await import("@openpresentation/opf-render/export-browser")).toPng(svg as `<${string}`, { ...options, svgSource: "data" }),
	toPdf: async (svgs: unknown, options?: object) => (await import("@openpresentation/opf-render/export-browser")).toPdf(svgs, { ...options, svgSource: "data" }),
};

async function copyText(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		// A sandboxed frame without the clipboard permission: copy through a selection instead.
		const area = document.createElement("textarea");
		area.value = text;
		area.style.cssText = "position:fixed;opacity:0";
		document.body.append(area);
		area.select();
		const copied = document.execCommand("copy");
		area.remove();
		if (!copied) throw new Error("The host did not allow the copy.");
	}
}

// -------------------------------------------------------------------------------------------------------------------
// Start: the tool's arguments arrive once (ui/notifications/tool-input), after the host has initialized the view.

const isText = (value: unknown): value is string => typeof value === "string";

async function start(args: ShowDeckArguments): Promise<void> {
	if (started) return;
	started = true;
	const format: Format = args.format ?? (isText(args.document) && !/^[\s﻿]*[[{]/.test(args.document) ? "yaml" : "json");
	if (args.document === undefined) {
		fail(`${sentence(assistant())} sent no deck.`);
		return;
	}
	status("Drawing the slides…");
	fonts = await fontsReady;
	const textForm = isText(args.document) && format !== "json";
	// Export is offered where the host saves files (ui/download-file): the sandbox cannot, and a menu that makes a file nobody gets
	// would be worse than none.
	const canSave = Boolean(app.getHostCapabilities()?.downloadFile);
	const exportSlot = $("deck-export");
	exportSlot.hidden = !canSave;
	// Edits count from the moment the deck is on screen; the first load is not one.
	let ready = false;
	// The editor is given the whole view, so its theme covers the viewer's own bar and footer as well as its parts.
	editor = createOpfEditor(shell, {
		// JSON (an object or its text) opens as the document; YAML and Markdown open as source text once the editor is ready.
		document: textForm ? { name: "Untitled", slides: [{ title: " " }] } : args.document,
		fonts,
		catalogs,
		fit: "contain",
		theme: hostTheme(),
		// The footer's verdict is the editor's review pill, worded as the playground words it.
		labels: { reviewPill: { valid: "Valid OPF" } },
		icons: { valid: "M20 6 9 17l-5-5" },
		source: {
			onCopy: (file) => copyText(file.text),
			onDownload: (file) => saveFile(file.filename, file.mime, file.text),
		},
		// The agent handoff is left out of the menu: the deck is already in a conversation with one.
		...(canSave ? { export: { exportPptx, onDownload: (file: { blob: Blob; fileName: string }) => saveFile(file.fileName, file.blob.type || "application/octet-stream", file.blob), convertOptions: { converters }, items: { agent: false } } as never } : {}),
		// The editor's own parts, each in the viewer's element: the deck's name, the review pill (the footer's verdict) and the Review
		// panel (in a drawer the verdict opens), the Design quick menu (theme, colours, fonts and this slide's layout) and Find and
		// replace (Ctrl/Cmd F). Undo and Redo are the viewer's icon buttons over the editor's undo() and redo(). The slide navigator
		// (previous, "01 / 16", next) sits in the footer, so the thumbnail strip has the whole row under the slide.
		slots: {
			title: $("deck-title"),
			reviewPill: $("deck-verdict"),
			review: $("deck-review-panel"),
			designMenu: $("deck-design"),
			...(canSave ? { export: exportSlot } : {}),
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
	// Undo stops at the deck as it was opened: loading it (YAML and Markdown load as one change) is not the person's edit.
	let depth = 0;
	let openedAt = 0;
	editor.on("change", (event) => {
		depth = (event.event as { snapshot?: { undoDepth?: number } } | undefined)?.snapshot?.undoDepth ?? (event.canUndo ? openedAt + 1 : 0);
		undoButton.disabled = !ready || depth <= openedAt;
		redoButton.disabled = !ready || !event.canRedo;
		if (!ready) return;
		edited = true;
		unsent = true;
		syncSend();
		setSync(app.getHostCapabilities()?.updateModelContext ? "pending" : "none");
		showDeck();
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
	openedAt = depth;
	mounted = true;
	shell.dataset.ready = "true";
	if (typeof args.slide === "number" && args.slide >= 1) editor.setSlide(args.slide - 1);
	setView(VIEWS.includes(args.view as View) ? (args.view as View) : "preview");
	showDeck();
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
undoButton.addEventListener("click", () => {
	if (!undoButton.disabled) editor?.undo();
});
redoButton.addEventListener("click", () => editor?.redo());
findButton.addEventListener("click", () => editor?.openFind());
reviewClose.addEventListener("click", () => setReviewOpen(false));
reviewDrawer.addEventListener("keydown", (event) => {
	if (event.key === "Escape") setReviewOpen(false);
});
sendButton.addEventListener("click", () => void sendToClaude());
expandButton.addEventListener("click", () => void setDisplayMode(context.displayMode === "fullscreen" ? "inline" : "fullscreen"));

app.ontoolinputpartial = () => {
	if (!started) status(`${sentence(assistant())} is writing the deck…`);
};
app.ontoolinput = (params) => void start((params.arguments ?? {}) as ShowDeckArguments).catch((error: unknown) => fail(`The deck could not open: ${error instanceof Error ? error.message : String(error)}`));
app.ontoolresult = (result) => {
	if (result.isError && !started) {
		const text = result.content?.find((part) => part.type === "text");
		fail(text && "text" in text ? String(text.text) : "The tool failed.");
	}
};
app.ontoolcancelled = () => {
	if (!started) fail(`${sentence(assistant())} stopped before the deck was ready.`);
};
app.onhostcontextchanged = (update) => applyContext(update);
app.onteardown = async () => {
	if (contextTimer) await sendContext();
	return {};
};

$("deck-version").textContent = `OPF ${MCP_VERSION}`;
setView("preview");
await app.connect();
applyContext(app.getHostContext() ?? {});
