// The OPF deck view: the MCP App that `show_deck` and `open_editor` open (ui://opf/deck). It runs in the host's sandboxed iframe and
// does the deck's work there, on the user's machine: the editor session, the source pane, the slide renderer and the checks are the
// OPF packages themselves (@openpresentation/opf-editor, opf-render and the precompiled validators of @openpresentation/opf). The
// server only hands over this page and, when a deck needs them, font files. The sandbox allows no network, no eval and no WASM; the
// build (scripts/build-app.mjs) bundles everything into one HTML file and picks the precompiled validators.
//
// The loop: the host sends the tool's arguments (show_deck's deck) or its result (open_editor's starter deck), the view mounts the
// editor and shows Preview, Source or Both. Every edit is applied, checked and redrawn here; one second after the last edit the whole
// deck goes to the model as context (ui/update-model-context), and "Send to Claude" also asks for a turn (ui/message). Where the
// host calls tools in the view (MCP Apps app tools), the model also reads and edits the open deck in place: read_deck, select_slide
// and edit_deck, registered before connect() and never changed afterwards.
//
// Instances: every tool call mounts its own view, and earlier ones stay live. The server mints an order key and a session key in
// its result (`structuredContent.viewer`; the session is the caller's, or derived from the deck's name); views of the same session
// meet on a BroadcastChannel named by that key, and the older one greys out and stops publishing (context, messages, tool edits).
// Views of other sessions never hear each other.
//
// The look is the openpresentation.org design system's playground bar (a 48px bar, a 28px status footer; view.css) in one
// palette: the viewer's own chrome and the editor's parts read the same `--opf-ui-*` tokens, mapped onto the host's colors.
import { App, type McpUiDisplayMode, type McpUiHostContext, applyDocumentTheme, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { gallery } from "@openpresentation/gallery";
import { type Finding, embed, validate } from "@openpresentation/opf";
import { createOpfEditor, layoutOptionsFor, type OpfEditor } from "@openpresentation/opf-editor/workspace";
import { type BrowserFontsHandle, loadFonts } from "@openpresentation/opf-render/fonts-browser";
import { z } from "zod";
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
/** What the server mints for each view (show_deck and open_editor results): the session it belongs to and its place in it. */
interface ViewerKey {
	session: string;
	createdAt: number;
	/** A random tie-break, minted per call (the server counts nothing). */
	tie: number;
}
interface ExampleEntry {
	slug: string;
	name: string | null;
}

const VIEWS: readonly View[] = ["preview", "source", "both"];
const CONTEXT_DELAY = 1000;
const CHECK_DELAY = 400;
const MAX_LISTED_FINDINGS = 20;
/** Claude reads at most 100,000 characters of a tool result; a read stays under it with room for its header. */
const RESULT_LIMIT = 100_000;
/** read_deck's outline: at most this many characters of JSON, each title at most MAX_TEXT; a source page always has MIN_ROOM. */
const OUTLINE_CHARS = 30_000;
const MAX_TEXT = 200;
const MIN_ROOM = 40_000;
const MAX_OPERATIONS = 100;
const MAX_EDIT_CHARS = 200_000;
/** A status message stays this long, then the footer clears it (the next message replaces it sooner). */
const STATUS_TIME = 8000;
/** A host's save dialog can stay open a while: ten minutes before a download counts as unconfirmed (the SDK's default is 60 s). */
const DOWNLOAD_TIMEOUT = 600_000;
const MESSAGE = "I edited the deck in the OPF viewer. Please continue from my version.";
const catalogs = [gallery];

const root = document.documentElement;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const shell = $("opf-deck");
const wait = $("deck-wait-text");
const sync = $("deck-sync");
const note = $("deck-note");
const startBar = $("deck-start");
const exampleSelect = $<HTMLSelectElement>("deck-example");
const pasteButton = $<HTMLButtonElement>("deck-paste");
const undoButton = $<HTMLButtonElement>("deck-undo");
const redoButton = $<HTMLButtonElement>("deck-redo");
const findButton = $<HTMLButtonElement>("deck-find-open");
const reviewDrawer = $("deck-review");
const reviewClose = $<HTMLButtonElement>("deck-review-close");
const sendButton = $<HTMLButtonElement>("deck-send");
const expandButton = $<HTMLButtonElement>("deck-expand");
const tabs = VIEWS.map((view) => $<HTMLButtonElement>(`tab-${view}`));

// `tools: {}`: the view's tools are a constant set, so it never announces a changed list.
const app = new App({ name: "OPF deck view", version: MCP_VERSION }, { availableDisplayModes: ["inline", "fullscreen"], tools: {} });

let editor: OpfEditor | undefined;
let fonts: BrowserFontsHandle | undefined;
let context: McpUiHostContext = {};
let view: View = "preview";
/** The deck differs from the one that was opened (by anyone); the user changed it; there are user edits not yet sent. */
let edited = false;
let userEdited = false;
let unsent = false;
let sending = false;
let downloading = false;
/** An edit_deck call is being applied: its change is the model's, not the user's. */
let byTool = false;
let phase: "loading" | "ready" | "failed" = "loading";
let superseded = false;
let tornDown = false;
let viewer: ViewerKey | undefined;
let channel: BroadcastChannel | undefined;
let examples: ExampleEntry[] = [];
/** Opened by open_editor: the start row (an example to open, a deck to paste) shows once the deck is on screen. */
let editorEntry = false;
/** What open_editor opened, for the model's first context: the starter deck or a bundled example. */
let openedWith: { example: string | null; name: string | null } | undefined;
/**
 * The source pane's text as of the last change of the deck or the last check of the text: text that differs from it is typing the pane
 * has not taken in yet (a check runs after a pause in typing; a valid result changes the deck, an invalid one is a draft).
 */
let sourceBaseline: string | undefined;
const paneText = () => editor?.sourcePane?.editor.api.getValue();
const sourcePending = () => sourceBaseline !== undefined && paneText() !== sourceBaseline;
let statusTimer: ReturnType<typeof setTimeout> | undefined;
/** The tool's arguments arrived without a deck, or its result did: the other one must bring it. */
let inputWithoutDeck = false;
let resultWithoutDeck = false;
let counts = { error: 0, warning: 0, info: 0 };
let findings: Finding[] = [];
let contextTimer: ReturnType<typeof setTimeout> | undefined;
let checkTimer: ReturnType<typeof setTimeout> | undefined;
let started = false;
let mounted = false;
let themed: string[] = [];

/** What the person calls the model on the other side: Claude in Claude, "the assistant" in another MCP Apps host. */
const assistant = () => (isClaude() ? "Claude" : "the assistant");
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const textOf = (value: unknown) => (typeof value === "string" ? value : null);
/** A string cut to at most `max` characters (never inside a surrogate pair), with an ellipsis when it was longer. */
const clip = (value: unknown, max = MAX_TEXT) => {
	if (typeof value !== "string") return null;
	if (value.length <= max) return value;
	const end = /[\uD800-\uDBFF]/.test(value.charAt(max - 2)) ? max - 2 : max - 1;
	return `${value.slice(0, end)}…`;
};
/** A short, stable fingerprint of a text (FNV-1a, 32 bits): read_deck marks each source page with the text it was cut from. */
const fingerprint = (text: string) => {
	let hash = 0x811c9dc5;
	for (let at = 0; at < text.length; at++) hash = Math.imul(hash ^ text.charCodeAt(at), 0x01000193);
	return (hash >>> 0).toString(16).padStart(8, "0");
};
const isClaude = () => /claude/i.test(app.getHostVersion()?.name ?? "");

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
	clearTimeout(checkTimer);
	checkTimer = undefined;
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
/** The checks of the deck as it is now, run at once when an edit is still waiting for them. */
const currentChecks = () => {
	if (checkTimer && editor) runChecks(editor.getDocument());
	return { ...counts, findings: findings.filter((finding) => finding.severity !== "info").slice(0, MAX_LISTED_FINDINGS).map(({ severity, ruleId, path, message }) => ({ severity, ruleId, path: path || "/", message })) };
};

// -------------------------------------------------------------------------------------------------------------------
// What the model hears: the whole deck after the user's edits (it keeps editing from it), and the checks either way.

const findingLines = () => currentChecks().findings.map((finding) => `- ${finding.severity} ${finding.ruleId} at ${finding.path}: ${finding.message}`);

function contextText(): string {
	const deck = editor?.getDocument();
	const slides = Array.isArray((deck as { slides?: unknown[] } | undefined)?.slides) ? (deck as { slides: unknown[] }).slides.length : 0;
	const at = editor ? editor.slideIndex + 1 : 1;
	const lines = findingLines();
	const checks = `Checks in the viewer: ${counts.error} errors, ${counts.warning} warnings, ${counts.info} notes.${lines.length ? `\n${lines.join("\n")}` : ""}`;
	const where = editor ? ` Revision ${editor.session.documentHash()}${viewer ? `, viewer session ${viewer.session}` : ""}.` : "";
	const json = `\n\nThe current deck:\n\`\`\`json\n${JSON.stringify(deck, null, 2)}\n\`\`\``;
	// open_editor sent no deck of the model's: the first context says what opened, with the deck itself.
	if (!edited && openedWith) {
		const what = openedWith.example ? `the bundled example deck ${openedWith.example}${openedWith.name ? ` ("${openedWith.name}")` : ""}` : `a starter deck${openedWith.name ? ` "${openedWith.name}"` : ""}`;
		return `The OPF viewer's editor opened ${what} (${slides} slides, slide ${at} open, ${view} view). The user can edit it there.${where} ${checks}${json}`;
	}
	if (!edited) return `The OPF viewer shows the deck you sent (${slides} slides, slide ${at} open, ${view} view).${where} ${checks}`;
	const who = userEdited ? "The user edited the deck in the OPF viewer" : "The deck in the OPF viewer has your edit_deck changes";
	return `${who} (${slides} slides, slide ${at} open). Continue from this version, not the one you sent.${where} ${checks}${json}`;
}

/** A view that another view of its session replaced, or that the host closed, publishes nothing. */
const silent = () => superseded || tornDown;

async function sendContext(): Promise<void> {
	clearTimeout(contextTimer);
	contextTimer = undefined;
	if (!editor || silent() || !app.getHostCapabilities()?.updateModelContext) return;
	const deck = editor.getDocument();
	try {
		await app.updateModelContext({ content: [{ type: "text", text: contextText() }], structuredContent: { edited, counts, findings: findings.slice(0, MAX_LISTED_FINDINGS), ...(edited || openedWith ? { document: deck as Record<string, unknown> } : {}) } });
		// Edits made while this update was on its way wait for the next one.
		if (edited && !contextTimer && sync.dataset.state === "pending") setSync("shared");
	} catch (error) {
		status(`${sentence(assistant())} did not take the update: ${error instanceof Error ? error.message : String(error)}`);
	}
}

type SyncState = "none" | "pending" | "shared" | "sent" | "refused" | "unknown";
// What the person sees of that: their edits reach the model without a click, and the footer says where they are.
function setSync(state: SyncState): void {
	sync.dataset.state = state;
	const words: Record<SyncState, string> = {
		none: "",
		pending: "Edits not shared yet",
		shared: `${sentence(assistant())} has your edits`,
		// Claude accepted the message; the person still decides whether it goes (and nothing says the model read it). Another host's
		// acceptance is reported as no more than that.
		sent: isClaude() ? "Sent to Claude for your approval" : "Sent to the assistant",
		refused: `${sentence(assistant())} didn't take the message`,
		unknown: "The message couldn't be confirmed",
	};
	sync.textContent = words[state];
}

/** Send is the view's one primary action while there are user edits the model has not been asked about; it stays usable to retry. */
function syncSend(): void {
	sendButton.textContent = `Send to ${assistant()}`;
	sendButton.disabled = !userEdited || sending || silent();
	sendButton.dataset.unsent = String(unsent && !silent());
	sendButton.title = unsent ? `Ask ${assistant()} to continue from your version` : userEdited ? `Ask ${assistant()} again to continue from your version` : `Edit the deck, then send your version to ${assistant()}`;
}

const scheduleContext = () => {
	if (silent()) return;
	clearTimeout(contextTimer);
	contextTimer = setTimeout(() => void sendContext(), CONTEXT_DELAY);
};

/** Only on the person's click: the message points at the open deck (the deck itself goes as context, not in the message). */
async function sendToClaude(): Promise<void> {
	if (!editor || !userEdited || sending || silent()) return;
	sending = true;
	syncSend();
	try {
		if (checkTimer) runChecks(editor.getDocument());
		await sendContext();
		const result = await app.sendMessage({ role: "user", content: [{ type: "text", text: MESSAGE }] });
		if (result?.isError) {
			setSync("refused");
			status(`${sentence(assistant())} didn't take the message. You can send it again.`);
		} else {
			unsent = false;
			setSync("sent");
		}
	} catch {
		// A rejection (a timeout too) does not mean it was not sent: say what is known, and keep Send for a retry.
		setSync("unknown");
		status("The message couldn't be confirmed. You can send it again.");
	} finally {
		sending = false;
		syncSend();
	}
}

// -------------------------------------------------------------------------------------------------------------------
// Instances: the server's order key decides which view of a session is current (never the time a view mounted, and never a key the
// view made up itself). Without the server's key a view stays on its own.

let fallbackId: string | undefined;
const instanceId = () => String(app.getHostContext()?.toolInfo?.id ?? (fallbackId ??= crypto.randomUUID()));
type Announcement = ViewerKey & { type: "hello" | "born"; instanceId: string };
const isKey = (key: unknown): key is ViewerKey => typeof (key as ViewerKey)?.session === "string" && Number.isFinite((key as ViewerKey).createdAt) && Number.isFinite((key as ViewerKey).tie);
/** Is `a` newer than `b`: created later by the server's clock, then the server's random tie-break, then the instance id. */
const newer = (a: Announcement, b: Announcement) => (a.createdAt !== b.createdAt ? a.createdAt > b.createdAt : a.tie !== b.tie ? a.tie > b.tie : a.instanceId > b.instanceId);

function joinSession(key: unknown): void {
	if (viewer || !isKey(key) || typeof BroadcastChannel !== "function") return;
	viewer = { session: key.session, createdAt: key.createdAt, tie: key.tie };
	const me = (type: Announcement["type"]): Announcement => ({ type, ...(viewer as ViewerKey), instanceId: instanceId() });
	// A fixed ui.domain shares this origin across conversations: the channel is named by the session the server minted.
	channel = new BroadcastChannel(`opf-deck:${viewer.session}`);
	channel.onmessage = ({ data }: MessageEvent<Announcement>) => {
		if (!isKey(data) || data.session !== viewer?.session || typeof data.instanceId !== "string" || data.instanceId === instanceId()) return;
		if (data.type === "hello") channel?.postMessage(me("born"));
		if (newer(data, me("hello"))) supersede();
	};
	channel.postMessage(me("hello"));
}

function supersede(): void {
	if (superseded) return;
	superseded = true;
	clearTimeout(contextTimer);
	contextTimer = undefined;
	channel?.close();
	editor?.setReadOnly(true);
	// Nothing is shared any more, and nothing stays selected or focused in a view that takes no input.
	setSync("none");
	window.getSelection()?.removeAllRanges();
	if (document.activeElement instanceof HTMLElement && shell.contains(document.activeElement)) document.activeElement.blur();
	shell.dataset.superseded = "true";
	note.textContent = "A newer viewer of this deck is open in the conversation. This one is read-only and no longer shares changes.";
	note.hidden = false;
	for (const button of [sendButton, undoButton, redoButton, expandButton, pasteButton]) button.disabled = true;
	exampleSelect.disabled = true;
	syncSend();
}

// -------------------------------------------------------------------------------------------------------------------
// The view's tools (MCP Apps app tools): the model reads and edits the deck that is open here. Each answers in text (what the
// model reads), refuses with a normal result that says what to do instead, and works on this view only.

type ToolResult = { content: { type: "text"; text: string }[]; structuredContent: Record<string, unknown> };
/** The text (what the model reads) carries `shown` as JSON, then `tail`: a source piece goes once, as text, not again inside the JSON. */
const answer = (lead: string, data: Record<string, unknown>, tail = "", shown: Record<string, unknown> = data): ToolResult => ({ content: [{ type: "text", text: `${lead}\n${JSON.stringify(shown)}${tail}` }], structuredContent: data });
const refuse = (code: string, message: string, extra: Record<string, unknown> = {}): ToolResult => answer(message, { ok: false, code, message, ...extra });

/** Why this view cannot do the tool's work now, or undefined when it can. */
function unavailable(): ToolResult | undefined {
	if (tornDown) return refuse("closed", "This viewer was closed. Open the deck again with show_deck.");
	if (superseded) return refuse("superseded", "A newer viewer of this deck is open in the conversation; this one no longer reads or takes changes. Use the newest viewer's tools.");
	if (phase === "failed") return refuse("not-open", "No deck is open in this viewer: it did not open. Open one with show_deck.");
	if (!editor || phase !== "ready") return refuse("loading", "The deck is still loading in this viewer. Try again in a few seconds.");
	return undefined;
}

/** The person has an edit in progress: text open on the slide, typing the source pane has not applied yet, or a source draft. */
const userTyping = () => Boolean((editor as OpfEditor).canvas?.editingPath != null || sourcePending());
const BUSY = "The user is typing in the viewer (an edit on the slide or in the source is not finished). Nothing was applied. Try again after the user's next message.";

/**
 * The open deck's state, bounded whatever the deck: each name, id, title and finding message at most MAX_TEXT characters, and the
 * outline at most OUTLINE_CHARS of JSON (then `outlineTruncated` names how many slides it lists). `outline: false` leaves it out.
 */
function deckState(outline = true): Record<string, unknown> {
	const ed = editor as OpfEditor;
	const deck = ed.getDocument() as { name?: unknown; slides?: { id?: unknown; title?: unknown; layout?: unknown }[] };
	const slides = Array.isArray(deck.slides) ? deck.slides : [];
	const listed: { index: number; id: string | null; title: string | null; layout: string | null }[] = [];
	let size = 2;
	for (const [index, slide] of (outline ? slides : []).entries()) {
		const item = { index, id: clip(slide?.id), title: clip(slide?.title), layout: clip(slide?.layout, 100) };
		size += JSON.stringify(item).length + 1;
		if (size > OUTLINE_CHARS) break;
		listed.push(item);
	}
	const checks = currentChecks();
	return {
		ok: true,
		revision: ed.session.documentHash(),
		session: viewer?.session ?? null,
		name: clip(deck.name),
		slideCount: slides.length,
		selected: { index: ed.slideIndex, id: clip(slides[ed.slideIndex]?.id) },
		...(outline ? { outline: listed } : {}),
		...(outline && listed.length < slides.length ? { outlineTruncated: { listed: listed.length, of: slides.length } } : {}),
		sourceDraft: !ed.inSync || sourcePending(),
		checks: { ...checks, findings: checks.findings.map((finding) => ({ ...finding, path: clip(finding.path) as string, message: clip(finding.message, 300) as string })) },
	};
}

const sourceIn = async (deck: unknown, format: Format): Promise<string> => {
	if (format === "json") return JSON.stringify(deck, null, 2);
	if (format === "yaml") return (await import("@openpresentation/opf/yaml")).toYaml(deck as never).yaml;
	return (await import("@openpresentation/opf/markdown")).toMarkdown(deck as never).markdown;
};

app.registerTool(
	"read_deck",
	{
		title: "Read the deck open in the OPF viewer",
		description:
			"Read the deck open in this OPF viewer: its revision, name, slide outline, selected slide and current check findings, and optionally its source text.\nCall it before edit_deck: edit_deck needs the revision it returns, and the user may have edited the deck since you last saw it. Slide indexes count from 0, as in a JSON Pointer such as /slides/0/title. Long titles are shortened and a long outline is cut (outlineTruncated says how far it goes). With source (json, yaml or markdown) the result also carries the deck's text, in pages of under 100,000 characters: when a page says it was truncated, call again with the offset it names; pages after the first leave the outline out, and every page has a textHash (start again at 0 when it changes). session is this viewer's session key: show_deck or open_editor with the same deck or the same session replaces this viewer.",
		inputSchema: z.object({
			source: z.enum(["json", "yaml", "markdown"]).optional().describe("Also return the deck's text in this form. The form the user is editing in the source pane comes back exactly as written."),
			offset: z.number().optional().describe("With source: where the text starts, in characters (a whole number from 0). Default 0."),
		}),
	},
	async ({ source, offset }) => {
		const refused = unavailable();
		if (refused) return refused;
		if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) return refuse("invalid-input", `offset must be a whole number from 0 (it was ${offset}). Use the next offset a truncated read_deck result named, or leave it out.`);
		if (offset !== undefined && !source) return refuse("invalid-input", "offset pages the source text: pass source (json, yaml or markdown) with it.");
		const at = offset ?? 0;
		// Pages after the first leave the outline out, so every page has room for the text and paging always moves on.
		const state = deckState(at === 0);
		const lead = `The deck open in this viewer, at revision ${state.revision}.`;
		if (!source) return answer(lead, state);
		const ed = editor as OpfEditor;
		const pane = ed.sourcePane;
		const paneFormat: Format | undefined = pane ? ((pane.getFormat() === "md" ? "markdown" : pane.getFormat()) as Format) : undefined;
		// The text in the source pane as it stands, read without applying anything the user is still typing.
		const shown = paneFormat === source && pane ? pane.editor.api.getValue() : undefined;
		const draft = shown !== undefined && (sourcePending() || !ed.inSync);
		const text = shown ?? (await sourceIn(ed.getDocument(), source));
		let from = Math.min(at, text.length);
		// Never start or end a page inside a surrogate pair.
		if (from > 0 && from < text.length && /[\uDC00-\uDFFF]/.test(text.charAt(from)) && /[\uD800-\uDBFF]/.test(text.charAt(from - 1))) from -= 1;
		const header = JSON.stringify({ ...state, source: { format: source, offset: from, end: text.length, total: text.length, truncated: true, next: text.length, textHash: "00000000", draft } });
		const room = Math.max(MIN_ROOM, RESULT_LIMIT - lead.length - header.length - 700);
		let end = Math.min(text.length, from + room);
		if (end < text.length && /[\uD800-\uDBFF]/.test(text.charAt(end - 1))) end -= 1;
		const piece = text.slice(from, end);
		const more = end < text.length;
		const textHash = fingerprint(text);
		const info = { format: source, offset: from, end, total: text.length, truncated: more, ...(more ? { next: end } : {}), textHash, ...(draft ? { draft: true } : {}) };
		const how = more ? ` Truncated: call read_deck again with source "${source}" and offset ${end} for the rest. Every page carries textHash ${textHash}: if a later page has another textHash, the text changed (the user is editing it), so start again at offset 0.` : "";
		const what = draft ? ", the text in the source pane, which the user is still editing and the deck has not taken" : "";
		return answer(lead, { ...state, source: { ...info, text: piece } }, `\n\nSource (${source}, characters ${from} to ${end} of ${text.length}${what}).${how}\n${piece}`, { ...state, source: info });
	},
);

app.registerTool(
	"select_slide",
	{
		title: "Select a slide in the OPF viewer",
		description: "Show a slide in this OPF viewer, chosen by its index (from 0) or its id.\nGive exactly one of index and id. The user sees the slide; the deck does not change.",
		inputSchema: z.object({
			index: z.number().optional().describe("The slide's index, a whole number from 0 (read_deck's outline lists them)."),
			id: z.string().optional().describe("The slide's id."),
		}),
	},
	({ index, id }) => {
		const refused = unavailable();
		if (refused) return refused;
		const ed = editor as OpfEditor;
		if ((index === undefined) === (id === undefined || id === "")) return refuse("invalid-input", "Give exactly one of index (a whole number from 0) and id.");
		if (index !== undefined && (!Number.isInteger(index) || index < 0)) return refuse("invalid-input", `index must be a whole number from 0 (it was ${index}).`);
		// Changing slides would commit the person's open edit on the slide.
		if (userTyping()) return refuse("busy", BUSY);
		const slides = ((ed.getDocument() as { slides?: { id?: unknown }[] }).slides ?? []) as { id?: unknown }[];
		const at = id === undefined ? (index as number) : slides.findIndex((slide) => slide?.id === id);
		if (at < 0 || at >= slides.length) return refuse("unknown-slide", `There is no slide ${id === undefined ? `at index ${index}` : `with id ${id}`}: the deck has ${slides.length} slides (indexes 0 to ${slides.length - 1}). Call read_deck for the outline.`);
		if (!ed.setSlide(at)) return refuse("busy", "The viewer could not change slides now (an edit on the slide could not be committed). Try again in a moment.");
		return answer(`Slide ${at + 1} of ${slides.length} is on show.`, { ok: true, selected: { index: at, id: textOf(slides[at]?.id) }, slideCount: slides.length });
	},
);

const OPERATIONS = ["add", "remove", "replace", "move", "copy", "test"];
const operationSchema = z.object({
	op: z.string().describe("add, remove, replace, move, copy or test."),
	path: z.string().describe('A JSON Pointer into the deck, such as /slides/0/title or by id /slides/@intro/title. Not "" (the whole deck) and not /slides itself.'),
	from: z.string().optional().describe("For move and copy: the JSON Pointer to take the value from."),
	value: z.unknown().optional().describe("For add, replace and test: the JSON value."),
});

app.registerTool(
	"edit_deck",
	{
		title: "Edit the deck open in the OPF viewer",
		description:
			"Change the deck open in this OPF viewer with JSON Patch operations, applied as one undoable edit only if the deck is still at expectedRevision.\nGet the revision from read_deck (or the viewer's context). Edit only the parts that change: an operation on the whole deck (path or from \"\") and any operation but test on the whole slides array (path or from /slides) is refused, so edit slides one at a time (/slides/2, /slides/-). Paths are JSON Pointers and may name slides and blocks by id (/slides/@intro/title). Up to 100 operations, all or none. If the deck changed since that revision, nothing is applied and the result says to read it again; while the user is typing in the viewer nothing is applied either (try again after their next message). An edit that would make the deck invalid (format or references) is refused with the findings. In the source pane, JSON keeps its formatting; YAML and Markdown text is written again from the deck, so YAML comments are dropped (the pane says so). The result has the new revision, what changed and the viewer's check findings; the user sees the change at once and can undo it.",
		inputSchema: z.object({
			expectedRevision: z.string().describe("The revision read_deck returned (sha256:...)."),
			operations: z.array(operationSchema).describe("1 to 100 JSON Patch operations (RFC 6902), applied in order, all or none."),
		}),
	},
	({ expectedRevision, operations }) => {
		const refused = unavailable();
		if (refused) return refused;
		const ed = editor as OpfEditor;
		if (!expectedRevision) return refuse("invalid-input", "expectedRevision is empty: pass the revision read_deck returned.");
		if (operations.length < 1 || operations.length > MAX_OPERATIONS) return refuse("invalid-input", `Send 1 to ${MAX_OPERATIONS} operations (this call had ${operations.length}); split a larger change into several edit_deck calls.`);
		const unknownOp = operations.find((operation) => !OPERATIONS.includes(operation.op));
		if (unknownOp) return refuse("invalid-input", `Unknown operation op "${unknownOp.op}": use one of ${OPERATIONS.join(", ")}.`);
		if (operations.some((operation) => operation.path === "" || operation.from === "")) return refuse("whole-deck", 'Edit the parts that change (a path such as /slides/0/title), not the whole deck: an operation on the root path "" is refused.');
		if (operations.some((operation) => operation.op !== "test" && (operation.path === "/slides" || operation.from === "/slides"))) return refuse("whole-slides", "Edit slides one at a time (/slides/0, /slides/@intro, /slides/- to add one): adding, replacing, removing, moving or copying the whole /slides array is refused.");
		if (JSON.stringify(operations).length > MAX_EDIT_CHARS) return refuse("too-large", `The operations are over ${MAX_EDIT_CHARS} characters. Split the change into several edit_deck calls.`);
		// The person's own edit is never committed for them: while they are typing, nothing is applied.
		if (userTyping()) return refuse("busy", BUSY);
		if (!ed.inSync) return refuse("source-draft", "The user is editing the deck's text in the source pane and it is not a valid deck right now; an edit would replace their draft. Nothing was applied. Try again after the user's next message.");
		const before = ed.session.documentHash();
		const stale = () => refuse("stale-revision", `The deck changed since revision ${expectedRevision}: nothing was applied. Call read_deck for the current deck and its revision, then send the edit again against it.`, { revision: ed.session.documentHash() });
		if (expectedRevision !== before) return stale();
		byTool = true;
		let changed: { op: string; path: string }[];
		try {
			// The deck in the viewer is always valid (format and references): an invalid deck does not open, and invalid source text stays a
			// draft the session never takes. An edit keeps it so.
			const change = ed.session.applyPatch(operations as never, { source: "edit_deck", rejectInvalid: true }, { expectHash: expectedRevision });
			changed = change.patches.filter((operation) => operation.op !== "test").map((operation) => ({ op: operation.op, path: operation.path }));
		} catch (error) {
			const failed = error as { code?: string; message?: string; details?: { path?: string; issues?: { ruleId?: string; path?: string; message?: string }[] } };
			if (failed.code === "patch-hash-mismatch" || failed.code === "invalid-expect-hash") return stale();
			const issues = (failed.details?.issues ?? []).slice(0, 10).map(({ ruleId, path, message }) => ({ ruleId, path, message }));
			if (failed.code === "invalid-opf-edit") return refuse("invalid-result", "Nothing was applied: the edit would make the deck invalid. Fix the operations so these findings do not occur.", { issues, revision: before });
			return refuse(failed.code ?? "invalid-patch", `Nothing was applied: ${failed.message ?? String(error)}${failed.details?.path ? ` (at ${failed.details.path})` : ""}`, { revision: before });
		} finally {
			byTool = false;
		}
		runChecks(ed.getDocument());
		const revision = ed.session.documentHash();
		if (changed.length) ed.status(`${sentence(assistant())} changed the deck (${changed.length} ${changed.length === 1 ? "change" : "changes"}). Undo takes it back.`);
		const slides = (ed.getDocument() as { slides?: unknown[] }).slides;
		return answer(changed.length ? `Applied ${changed.length} ${changed.length === 1 ? "change" : "changes"} as one undoable edit; the deck is now at revision ${revision}.` : "Every test operation passed; nothing changed.", { ok: true, revision, previousRevision: before, changed, slideCount: Array.isArray(slides) ? slides.length : 0, checks: currentChecks() });
	},
);

// -------------------------------------------------------------------------------------------------------------------
// Views, display mode, size and the host's look.

const offered = (mode: McpUiDisplayMode) => (context.availableDisplayModes ?? []).includes(mode);

function setView(next: View, fromUser = false): void {
	view = next;
	shell.dataset.show = next;
	for (const [index, tab] of tabs.entries()) {
		const selected = VIEWS[index] === next;
		tab.setAttribute("aria-selected", String(selected));
		tab.tabIndex = selected ? 0 : -1;
	}
	// Side by side needs room: inline in a narrow chat, Both asks the host for more (it may say no; then the panes stack).
	if (fromUser && next === "both" && context.displayMode !== "fullscreen" && offered("fullscreen") && shell.clientWidth < 860) setDisplayMode("fullscreen");
}

/**
 * Ask the host for a display mode. Called straight from a click or key handler: a host honors the request only right after the
 * person pressed something in the view. The host answers with the mode the view is in; the same mode as before is a refusal.
 */
function setDisplayMode(mode: McpUiDisplayMode): void {
	const before = context.displayMode ?? "inline";
	app.requestDisplayMode({ mode }).then(
		(result) => {
			applyContext({ displayMode: result.mode });
			if (result.mode !== mode) status(`${sentence(assistant())} kept the viewer ${before === "fullscreen" ? "expanded" : "in the conversation"}.`);
		},
		() => status(`${sentence(assistant())} did not change the viewer's size.`),
	);
}

/**
 * One palette for the whole view. The editor's tokens are OPF's (the openpresentation.org design system); in a host that sends
 * the standard MCP Apps variables, the neutral ones are derived from the host's background and text instead, so the bar, the
 * source pane and the footer sit in the host's surface rather than beside it. The accent and the status colors stay OPF's.
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
	// On the shell itself too, so the view has its colors before the editor mounts.
	for (const name of themed) shell.style.removeProperty(name);
	themed = Object.keys(theme.tokens);
	for (const [name, value] of Object.entries(theme.tokens)) shell.style.setProperty(name, value);
	editor?.setTheme(theme);
}

/**
 * The layout follows the container the host gives the view (its width, and a fixed or a maximum height), not the display mode: a
 * side panel and full screen are both "fullscreen" and can be 320px or 1600px wide. The host's safe-area insets pad the view.
 */
function layOut(): void {
	const box = (context.containerDimensions ?? {}) as { width?: number; maxWidth?: number; height?: number; maxHeight?: number };
	const width = Math.min(box.width ?? box.maxWidth ?? Number.POSITIVE_INFINITY, window.innerWidth || Number.POSITIVE_INFINITY);
	root.dataset.size = width < 400 ? "compact narrow tiny" : width < 640 ? "compact narrow" : width < 860 ? "compact" : "wide";
	// Inline, the view is as tall as its content; a host that fixes the height, and full screen or the side panel (also when the host
	// sends no dimensions with it), get a view that fills the frame.
	root.dataset.fill = String(context.displayMode === "fullscreen" || typeof box.height === "number");
	if (typeof box.maxHeight === "number") shell.style.setProperty("--deck-max-height", `${box.maxHeight}px`);
	else shell.style.removeProperty("--deck-max-height");
	const insets = context.safeAreaInsets;
	for (const side of ["top", "right", "bottom", "left"] as const) shell.style.setProperty(`--deck-inset-${side}`, `${Math.max(0, insets?.[side] ?? 0)}px`);
}

function applyContext(update: Partial<McpUiHostContext>): void {
	context = { ...context, ...update };
	if (context.theme) applyDocumentTheme(context.theme);
	if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
	applyTheme();
	root.dataset.display = context.displayMode ?? "inline";
	layOut();
	// The expand control: to the larger view the host offers (its side panel or full screen; the host chooses), and back.
	const expanded = context.displayMode === "fullscreen";
	expandButton.hidden = !offered(expanded ? "inline" : "fullscreen");
	const expandLabel = expanded ? "Back to the conversation" : "Expand";
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
	clearTimeout(statusTimer);
	if (mounted && editor) {
		editor.status(message);
		if (message) statusTimer = setTimeout(() => editor?.status(""), STATUS_TIME);
	} else wait.textContent = message;
}

/** The deck will not open: the placeholder stops promising one. */
function fail(message: string): void {
	phase = "failed";
	status(message);
	clearTimeout(statusTimer);
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

/**
 * The name the host saves a file under is the last path segment of its `uri`, as written: a space stays a space (percent-encoding
 * is not decoded), and the host turns % : " * < > | ~ \ into "_". The view does that itself, and also for / # ? and control
 * characters, which would cut the segment short, so the name the person sees is the one the view chose.
 */
const savedName = (name: string) => name.replace(/[\u0000-\u001f\u007f/\\%:"*<>|~#?]/g, "_").trim() || "deck";

/** A file for the host to save, one request at a time. A large one is encoded in pieces: one call with every byte overflows the stack. */
async function saveFile(name: string, type: string, data: Blob | string): Promise<void> {
	if (!app.getHostCapabilities()?.downloadFile) {
		const error = new Error("This host does not support file downloads. Select the source text to save it.");
		status(error.message);
		throw error;
	}
	// A second request while the host's dialog is open would end one of them in an error: a click meanwhile does nothing.
	const refuse = (message: string) => {
		status(message);
		return new Error(message);
	};
	if (downloading) throw refuse("A download is already waiting for you. Finish or close it first.");
	const file = savedName(name);
	downloading = true;
	status("");
	let outcome: string;
	try {
		const uri = `file:///${file}`;
		let resource: { uri: string; mimeType: string; text: string } | { uri: string; mimeType: string; blob: string };
		if (typeof data === "string") resource = { uri, mimeType: type, text: data };
		else {
			const bytes = new Uint8Array(await data.arrayBuffer());
			let binary = "";
			for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
			resource = { uri, mimeType: type, blob: btoa(binary) };
		}
		const result = await app.downloadFile({ contents: [{ type: "resource", resource }] }, { timeout: DOWNLOAD_TIMEOUT });
		// isError: false means the host started the download; true means it did not finish (the host does not say why).
		outcome = result.isError ? "The download didn't finish." : "Download started.";
	} catch (error) {
		if ((error as { code?: unknown })?.code === -32601) {
			// The host does not offer downloads here after all: no more Download or Export; the source text can be copied instead.
			shell.dataset.download = "false";
			$("deck-export").hidden = true;
			outcome = "This host does not offer downloads here. Select the source text to copy it.";
		} else {
			// A rejection or a timeout: the host's dialog may still be open and still save the file, so nothing more is claimed.
			outcome = "The download couldn't be confirmed.";
		}
	} finally {
		downloading = false;
	}
	status(outcome);
	if (outcome !== "Download started.") throw new Error(outcome);
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
	const [{ toPptx }, { toPng }] = await Promise.all([import("./pptx-export.js"), import("@openpresentation/opf-render/export-browser")]);
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
// The editor's start row (open_editor): a starter deck to edit at once, a bundled example to open instead, or a deck to paste.

/** Once the person opened an example or pasted a deck, the row no longer calls it a starter deck. */
const leaveStarter = () => {
	$("deck-start-label").hidden = true;
};

function showStart(): void {
	const canOpen = Boolean(app.getHostCapabilities()?.serverTools) && examples.length > 0;
	exampleSelect.hidden = !canOpen;
	for (const example of canOpen ? examples : []) exampleSelect.add(new Option(example.name ? `${example.name} (${example.slug})` : example.slug, example.slug));
	startBar.hidden = false;
}

async function openExample(slug: string): Promise<void> {
	if (!editor || !slug || silent()) return;
	exampleSelect.disabled = true;
	status("Opening the example…");
	try {
		const result = await app.callServerTool({ name: "get_catalog_record", arguments: { kind: "examples", id: slug } });
		const record = (result.structuredContent as { record?: unknown } | undefined)?.record;
		if (result.isError || !record) throw new Error("the server sent no deck");
		if (!editor.setDocument(record)) throw new Error("the viewer did not take it");
		leaveStarter();
		status(`Opened the example ${slug}. Undo goes back to the deck before it.`);
	} catch (error) {
		status(`The example could not open: ${error instanceof Error ? error.message : String(error)}.`);
	} finally {
		exampleSelect.disabled = silent();
		exampleSelect.value = "";
	}
}

// -------------------------------------------------------------------------------------------------------------------
// Start: the tool's arguments arrive once (ui/notifications/tool-input), after the host has initialized the view; open_editor's
// deck arrives with its result (ui/notifications/tool-result).

const isText = (value: unknown): value is string => typeof value === "string";

async function start(args: ShowDeckArguments): Promise<void> {
	if (started) return;
	started = true;
	const format: Format = args.format ?? (isText(args.document) && !/^[\s﻿]*[[{]/.test(args.document) ? "yaml" : "json");
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
		// panel (in a drawer the verdict opens), the Design quick menu (theme, colors, fonts and this slide's layout) and Find and
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
		// The parts heard the change first: the source pane already shows the deck as it now is.
		sourceBaseline = paneText();
		depth = (event.event as { snapshot?: { undoDepth?: number } } | undefined)?.snapshot?.undoDepth ?? (event.canUndo ? openedAt + 1 : 0);
		undoButton.disabled = !ready || superseded || depth <= openedAt;
		redoButton.disabled = !ready || superseded || !event.canRedo;
		if (!ready) return;
		edited = true;
		// An edit_deck call is the model's own change: nothing for the person to send.
		if (!byTool) {
			userEdited = true;
			unsent = true;
			if (editorEntry) leaveStarter();
		}
		syncSend();
		if (!byTool) setSync(app.getHostCapabilities()?.updateModelContext && !silent() ? "pending" : "none");
		showDeck();
		scheduleChecks(event.document);
		scheduleContext();
	});
	editor.on("slide", () => scheduleContext());
	// Where the source pane stands: edit_deck waits for typing the pane has not taken in, rather than commit it for the person.
	editor.on("source", () => {
		sourceBaseline = paneText();
	});
	// The pill opens the Review panel: the editor has no side panel here, so it asks the host page (this view) to show it.
	editor.on("review-open", () => setReviewOpen(true));
	await editor.ready;
	// The source pane calls OPF Markdown "md".
	if (textForm) editor.setSourceText(args.document as string, { format: format === "markdown" ? "md" : "yaml" });
	ready = true;
	openedAt = depth;
	mounted = true;
	phase = "ready";
	sourceBaseline = paneText();
	shell.dataset.ready = "true";
	if (superseded) editor.setReadOnly(true);
	if (editorEntry) showStart();
	if (typeof args.slide === "number" && args.slide >= 1) editor.setSlide(args.slide - 1);
	setView(VIEWS.includes(args.view as View) ? (args.view as View) : "preview");
	showDeck();
	runChecks(editor.getDocument());
	await sendContext();
}

const startOrFail = (args: ShowDeckArguments) => void start(args).catch((error: unknown) => fail(`The deck could not open: ${error instanceof Error ? error.message : String(error)}`));

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
// Straight from the click: the host opens a larger view only right after the person pressed something in this one.
expandButton.addEventListener("click", () => setDisplayMode(context.displayMode === "fullscreen" ? "inline" : "fullscreen"));
exampleSelect.addEventListener("change", () => void openExample(exampleSelect.value));
/** The form of pasted deck text: JSON when it starts with { or [, OPF Markdown when it starts with front matter or a heading, else YAML. */
const pastedFormat = (text: string) => (/^[\s\uFEFF]*[[{]/.test(text) ? "json" : /^[\s\uFEFF]*(---\s*\n[\s\S]*?\n---|#\s)/.test(text) ? "md" : "yaml");
// Paste does the work: the whole source is selected and focused, so what the person pastes replaces it; where the host lets the view
// read the clipboard (on this click), the deck on it is put in at once.
pasteButton.addEventListener("click", () => {
	if (!editor || silent()) return;
	setView("source", true);
	const pane = editor.sourcePane;
	const selectAll = () => {
		const api = pane?.editor.api;
		api?.focus();
		api?.setSelection(0, api.getValue().length);
	};
	selectAll();
	const ask = () => status("Paste a deck in JSON, YAML or OPF Markdown: it replaces the selected text.");
	// Only where the frame is allowed to read the clipboard (the host's permissions policy); otherwise asking would only log a refusal.
	const policy = (document as unknown as { permissionsPolicy?: { allowsFeature(name: string): boolean }; featurePolicy?: { allowsFeature(name: string): boolean } });
	const allowed = (policy.permissionsPolicy ?? policy.featurePolicy)?.allowsFeature("clipboard-read") ?? false;
	const clipboard = allowed ? navigator.clipboard?.readText?.bind(navigator.clipboard) : undefined;
	if (!clipboard) return ask();
	clipboard().then(
		(text) => {
			if (!text.trim() || !editor) return ask();
			const taken = editor.setSourceText(text, { format: pastedFormat(text) });
			leaveStarter();
			status(taken ? "Pasted the deck from the clipboard. Undo goes back to the deck before it." : "Pasted the text from the clipboard; it is not a valid deck yet, so the slides still show the deck before it.");
		},
		() => {
			selectAll();
			ask();
		},
	);
});
window.addEventListener("resize", layOut);

app.addEventListener("toolinputpartial", () => {
	if (!started) status(`${sentence(assistant())} is writing the deck…`);
});
// show_deck's deck is its argument; open_editor's comes with the result.
app.addEventListener("toolinput", (params) => {
	const args = (params.arguments ?? {}) as ShowDeckArguments;
	if (args.document !== undefined) startOrFail(args);
	else if (resultWithoutDeck) fail(`${sentence(assistant())} sent no deck.`);
	else inputWithoutDeck = true;
});
app.addEventListener("toolresult", (result) => {
	const data = result.structuredContent as { viewer?: unknown; document?: unknown; editor?: unknown; example?: unknown; name?: unknown; examples?: unknown } | undefined;
	joinSession(data?.viewer);
	if (started) return;
	if (result.isError) {
		const text = result.content?.find((part) => part.type === "text");
		fail(text && "text" in text ? String(text.text) : "The tool failed.");
	} else if (data?.document !== undefined) {
		editorEntry = data.editor === true;
		if (editorEntry) openedWith = { example: textOf(data.example), name: textOf(data.name) };
		if (editorEntry && Array.isArray(data.examples)) examples = (data.examples as ExampleEntry[]).filter((item) => typeof item?.slug === "string");
		startOrFail({ document: data.document });
	} else if (inputWithoutDeck) fail(`${sentence(assistant())} sent no deck.`);
	else resultWithoutDeck = true;
});
app.addEventListener("toolcancelled", () => {
	if (!started) fail(`${sentence(assistant())} stopped before the deck was ready.`);
});
app.addEventListener("hostcontextchanged", (update) => applyContext(update));
app.onteardown = async () => {
	if (contextTimer) await sendContext();
	tornDown = true;
	channel?.close();
	syncSend();
	return {};
};

$("deck-version").textContent = `OPF ${MCP_VERSION}`;
setView("preview");
layOut();
await app.connect();
applyContext(app.getHostContext() ?? {});
