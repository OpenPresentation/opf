import type { Catalog } from "@openpresentation/opf";
import type { ToSvgOptions } from "@openpresentation/opf-render";
import type { CanvasEditor, CanvasEditorOptions, EditorFonts } from "./canvas.js";
import type { DesignControls, DesignControlsOptions } from "./design-controls.js";
import type { EditorEvent, EditorSession } from "./index.js";
import type { ExportMenu, ExportMenuOptions } from "./export-menu.js";
import type { FindPanel, FindPanelOptions } from "./find-panel.js";
import type { LayoutStudio } from "./workspace-layouts.js";
import type { AutosaveStatus, Persistence, PersistenceOptions } from "./persistence.js";
import type { Presenter } from "./presenter.js";
import type { ReviewFinding, ReviewHook } from "./review.js";
import type { ReviewPanel, ReviewPanelOptions } from "./review-panel.js";
import type { SlideManager } from "./slide-manager.js";
import type { SourceCursor, SourceFormat, SourceFile, SourcePane, SourcePaneOptions } from "./source-pane.js";

export type OpfEditorLayout = "full" | "canvas" | "source" | "studio" | "playground";
export type OpfEditorView = "slide" | "sorter" | "outline" | "layouts";
export type OpfEditorDensity = "comfortable" | "touch";

/** The short names of a theme, each one `--opf-ui-*` custom property. The full names are accepted too. */
export declare const THEME_TOKENS: Readonly<{
  background: "--opf-ui-bg";
  surface: "--opf-ui-surface";
  muted: "--opf-ui-muted";
  mutedAlt: "--opf-ui-muted-2";
  text: "--opf-ui-fg";
  textMuted: "--opf-ui-muted-fg";
  accent: "--opf-ui-accent";
  accentText: "--opf-ui-accent-fg";
  accentStrong: "--opf-ui-accent-strong";
  border: "--opf-ui-border";
  borderStrong: "--opf-ui-border-strong";
  focus: "--opf-ui-ring";
  danger: "--opf-ui-danger";
  warning: "--opf-ui-warn";
  success: "--opf-ui-success";
  codeBackground: "--opf-ui-code-bg";
  codeBorder: "--opf-ui-code-border";
  selection: "--opf-ui-selection";
  hover: "--opf-ui-hover";
  canvasBackground: "--opf-ui-studio-canvas-bg";
  font: "--opf-ui-font";
  mono: "--opf-ui-mono";
  radiusSmall: "--opf-ui-radius-sm";
  radius: "--opf-ui-radius";
  radiusMedium: "--opf-ui-radius-md";
  radiusLarge: "--opf-ui-radius-lg";
  controlHeight: "--opf-ui-control-h";
  shadow: "--opf-ui-shadow-pop";
  motion: "--opf-ui-ease";
}>;
export type ThemeTokenName = keyof typeof THEME_TOKENS;
/** Token values by short name or by full custom-property name: `{ accent: "#0a7", "--opf-ui-border": "#ddd" }`. */
export type ThemeTokens = Partial<Record<ThemeTokenName, string>> & { [property: `--opf-ui-${string}`]: string | undefined };

export interface OpfEditorTheme {
  /**
   * `light` or `dark` forces the scheme for this editor, `auto` follows `prefers-color-scheme`, and `inherit` (the default) leaves it to the
   * host page, which marks dark with `.dark` or `[data-theme="dark"]` on `<html>` (or any ancestor).
   */
  colorScheme?: "light" | "dark" | "auto" | "inherit";
  /** Values for both schemes. */
  tokens?: ThemeTokens;
  /** Values that replace `tokens` (and the defaults) while the editor is dark. */
  dark?: ThemeTokens;
}
export interface NormalizedTheme {
  colorScheme: "light" | "dark" | "auto" | "inherit";
  tokens: Record<string, string>;
  dark: Record<string, string>;
}
/** Full custom-property names for a map of short or full token names. Throws on a name that is not in the contract. */
export declare function normalizeThemeTokens(map: ThemeTokens | undefined, label?: string): Record<string, string>;
export declare function normalizeTheme(theme: OpfEditorTheme | undefined): NormalizedTheme;
export interface ThemeController {
  readonly theme: NormalizedTheme;
  update(theme: OpfEditorTheme | undefined): NormalizedTheme;
  destroy(): void;
}
/** Apply a theme to the editor mounted in `root`. `createOpfEditor` does this for `options.theme` and `handle.setTheme`. */
export declare function createThemeController(root: HTMLElement, theme?: OpfEditorTheme): ThemeController;

/**
 * The options for composing slide `slideIndex` of `deck` with the fonts handle `fonts`: its text measurement, made script-aware for this document
 * (Japanese under Aptos measures with Noto Sans JP, where the plain strict measurement would throw). Pass the result to the session's
 * `composeSlide` and `paginateSlide`, and the same `catalogs` the editor was given. Without a handle it is `{}`, and a handle without a
 * measurement is passed through.
 */
export declare function layoutOptionsFor(
  fonts: EditorFonts | undefined,
  deck: unknown,
  slideIndex: number,
  catalogs?: readonly Catalog[],
): { fonts?: EditorFonts };

/** What a host's own acquire function returns: the handle and the way to give it back. */
export interface OpfEditorFontsLease {
  fonts: EditorFonts;
  release(): void;
}
/**
 * The fonts the editor draws with: the renderer's handle, a lease (`{ fonts, release() }`), a promise of either, a function that returns any of those
 * (called once), or `{ lease(), release(fonts) }`. A lease is given back exactly once on `destroy()`, also when the editor was destroyed before it arrived.
 */
export type OpfEditorFontsOption =
  | EditorFonts
  | OpfEditorFontsLease
  | Promise<EditorFonts | OpfEditorFontsLease>
  | (() => EditorFonts | OpfEditorFontsLease | Promise<EditorFonts | OpfEditorFontsLease>)
  | { lease(): EditorFonts | OpfEditorFontsLease | Promise<EditorFonts | OpfEditorFontsLease>; release?(fonts: EditorFonts): void };

/**
 * The elements a host arranges itself. Each part mounts in its own slot; a part without one is not mounted. With `slots`, nothing is built.
 * `overlay` is where dialogs (the presenter, the agent handoff) mount; it defaults to a node inside the mount element.
 */
export interface OpfEditorSlots {
  source?: HTMLElement;
  canvas?: HTMLElement;
  /** The element hidden while another view shows (default: the canvas element). */
  slide?: HTMLElement;
  /** A host for the canvas's property forms (default: a floating panel on the canvas). */
  properties?: HTMLElement;
  navigator?: HTMLElement;
  thumbnails?: HTMLElement;
  /** The slide list (a vertical navigator) and, apart, the element for its Duplicate, Delete and Hide buttons. */
  slides?: HTMLElement;
  slideToolbar?: HTMLElement;
  sorter?: HTMLElement;
  outline?: HTMLElement;
  layouts?: HTMLElement;
  /** The element that is hidden while its view is not shown, when it is not the element the view mounts in (`sorterView`, `outlineView`, `layoutsView`). */
  sorterView?: HTMLElement;
  outlineView?: HTMLElement;
  layoutsView?: HTMLElement;
  export?: HTMLElement;
  present?: HTMLElement;
  review?: HTMLElement;
  design?: HTMLElement;
  find?: HTMLElement;
  /** The restore prompt and the autosave line of `persistence`. */
  banner?: HTMLElement;
  autosave?: HTMLElement;
  /** The status line: the editor writes its messages here. */
  status?: HTMLElement;
  overlay?: HTMLElement;
  /** CE-20, the Studio: an element of the host placed at the end of the Studio's bar (Share, avatars). */
  topbarEnd?: HTMLElement;
}

/** CE-20: one item of the Studio's selection. `key` is the scene key (the id path, `/slides/@intro/blocks/@kpi`; a layout region `<slide key>#<name>`). */
export interface OpfStudioSelectionItem { key: string; path: string; idPath?: string; kind: "slide" | "heading" | "region" | "group" | "block" | "part" | "implicit" }
/** CE-20: a command of the Studio's registry (`studio.group`, `studio.insert.chart`, ...). `when` returns true, or a reason string that disables it. */
export interface OpfCommand<Ctx = unknown> {
  id: string;
  label: string;
  group?: string;
  /** CodeMirror-style keys ("Mod-g", "Shift-Mod-z", "F2"); Mod is Cmd on macOS and Ctrl elsewhere. */
  keys?: string[];
  /** "canvas": only while focus is on the slide, the layers or the filmstrip; "global" (default) anywhere outside a field. */
  scope?: "canvas" | "global" | ("canvas" | "global")[];
  when?(ctx: Ctx): boolean | string;
  run(ctx: Ctx): boolean | void;
}
export interface OpfCommandInfo { id: string; label: string; group?: string; keys: string[]; shortcut: string; enabled: boolean; reason: string }
/** CE-20: a host's panel in the Studio: a tab of the right panel (default) or a section of the left (`side: "left"`); `mount` returns its cleanup. */
export interface OpfStudioHostPanel { id: string; label: string; icon?: SVGElement | string; side?: "left" | "right"; mount(element: HTMLElement, editor: OpfEditor): void | (() => void) }
/** CE-20: the Studio's options (`layout: "studio"` or `"playground"`). */
export interface OpfStudioOptions {
  /** Which panels the Studio shows; `source` is where the source split opens ("split-right" by default on wide screens, "split-bottom" below 1100px). */
  panels?: { source?: "split-right" | "split-bottom" | "tab" | false };
  hostPanels?: OpfStudioHostPanel[];
  /** Items added to the File menu. */
  fileItems?: { id: string; label: string; run(editor: OpfEditor): void }[];
  /** More commands for the registry (a host palette lists them with the Studio's). */
  commands?: OpfCommand[];
  /** Rebind commands: `{ "studio.source.toggle": ["Mod-Alt-s"] }`; `null` unbinds. */
  keymap?: Record<string, string[] | null>;
  /** Panel sizes stored per host key (nothing is stored without `storage`). */
  sizes?: { key: string; storage?: { get(key: string): string | null; set(key: string, value: string): void } };
  /** Give a deck without ids its ids when the Studio opens it (default true; one undoable change named "Add ids"). Never in the Playground. */
  assignIds?: boolean;
}

export interface OpfEditorPanels {
  /** The code editor (JSON, YAML, Markdown). */
  source?: boolean;
  /** The slide itself. Default true (false in a `"source"` layout). */
  canvas?: boolean;
  /** Previous, counter, next. */
  navigator?: boolean;
  thumbnails?: boolean;
  /** Undo and redo buttons in the default layouts. */
  history?: boolean;
  find?: boolean;
  /** The Present button, F5 and the full-screen presenter. */
  present?: boolean;
  export?: boolean;
  review?: boolean;
  /** The design controls (themes, fonts, backgrounds, table and chart options). Off by default; give `design.vocabularies` for the full set. */
  design?: boolean;
  /** The views: Layout Studio, the slide sorter and the outline. */
  layouts?: boolean;
  sorter?: boolean;
  outline?: boolean;
  /** The vertical slide list (slots only). */
  slides?: boolean;
  /** Autosave and the restore prompt; on when `persistence` is given. */
  persistence?: boolean;
}

export interface OpfEditorSourceOptions {
  format?: SourceFormat;
  /** The file name without extension. */
  name?: string;
  /** The text of the document as the author wrote it, so its spelling is kept. A string `document` is used when this is not given. */
  text?: string;
  /** The Web Worker that runs the pane's text checks off the main thread: `true`, a `Worker`, a function that returns one, or the URL of a worker script (docs/embedding.md, "The source worker"). Default: the main thread. */
  worker?: SourcePaneOptions["worker"];
  /** Core `validate` options for the verdict on the text (default the format and reference rules). */
  checks?: { only?: readonly string[]; [key: string]: unknown };
  outline?: SourcePaneOptions["outline"];
  applyDelay?: number;
  /** Milliseconds of quiet before a `cursor` event (default 50). */
  cursorDelay?: number;
  completions?: boolean;
  label?: string;
  catalogs?: SourcePaneOptions["catalogs"];
  resolvePreview?: SourcePaneOptions["resolvePreview"];
  onRename?(name: string): void;
  /** Take the copied or downloaded source yourself (the defaults are the clipboard and a Blob download). */
  onCopy?(file: SourceFile): void | Promise<void>;
  onDownload?(file: SourceFile): void | Promise<void>;
}

export interface OpfEditorOptions {
  /** The document to edit: an OPF object, or its JSON text (then the pane keeps its spelling). Creates the session. */
  document?: unknown;
  /** An existing session to edit instead of creating one. Register its catalogs on it. */
  session?: EditorSession;
  /** The host's catalogs (for example `[gallery]`): for the session the editor creates, and for every draw. */
  catalogs?: readonly Catalog[];
  /** The renderer's fonts handle. See `OpfEditorFontsOption`. A function or a lease is called once; `release` runs on `destroy()`. */
  fonts?: OpfEditorFontsOption;
  /** Extra `toSvg` options for every draw. */
  renderOptions?: ToSvgOptions;
  /** Turns an asset reference into a loadable address (the renderer's `imageResolver`), for every draw. */
  imageResolver?: ToSvgOptions["imageResolver"];
  /** Stores an uploaded image yourself and returns its reference (see `@openpresentation/opf-editor/assets`). Used by the design controls. */
  onAddAsset?: DesignControlsOptions["onAddAsset"];
  /** `"authored"` (default): the canvas shows `{{variables}}` as written. `"resolved"`: filled in, except in a template deck; a press on filled-in text opens its properties form. */
  variables?: "authored" | "resolved";

  /**
   * `"full"` (default), `"canvas"` or `"source"`: the editor builds the arrangement (ignored when `slots` is given). CE-20: `"studio"` is the
   * Presentation and Slide Studio and `"playground"` its first-contact preset (a host's `slots` then add parts, such as `topbarEnd`).
   */
  layout?: OpfEditorLayout;
  /** CE-20: the Studio's options. */
  studio?: OpfStudioOptions;
  /** CE-20: `import.pptx(editor)` adds "Import PowerPoint…" to the Studio's File menu. */
  import?: { pptx?(editor: OpfEditor): void };
  slots?: OpfEditorSlots;
  panels?: OpfEditorPanels;
  /** The view shown first (default `"slide"`). */
  view?: OpfEditorView;
  /** The side tab shown first in the default layout. */
  panel?: "review" | "design";
  /** The slide shown first (0-based). */
  slideIndex?: number;
  /** `"contain"` sizes the slide to fit its frame (default in the built layouts); `false` leaves the size to the host. */
  fit?: "contain" | false;

  source?: OpfEditorSourceOptions;
  canvas?: Omit<CanvasEditorOptions, "editor" | "fonts" | "renderOptions" | "slideIndex" | "presentation" | "catalogs" | "propertiesContainer">;
  export?: Omit<ExportMenuOptions, "getDeck" | "fonts" | "catalogs" | "mode" | "density" | "beforeExport">;
  review?: boolean | (Omit<ReviewPanelOptions, "editor" | "getSlideIndex" | "getValidateOptions" | "autoRefresh" | "onGoTo" | "onFocusField" | "onStatus" | "onChange" | "review"> & { hook?: ReviewHook });
  find?: boolean | { onGoTo?: FindPanelOptions["onGoTo"] };
  design?: boolean | Omit<DesignControlsOptions, "editor" | "getSlideIndex" | "getSelectedPath" | "onSelectPath" | "onStatus" | "catalogs" | "onAddAsset">;
  /** Autosave to this browser and a restore prompt. `key` names the document. `false` or absent: nothing is stored. */
  persistence?: false | (PersistenceOptions & { suffix?: string; fallback?: string });

  /** Refuse every write that comes through the editor's own parts, and lock the slide. The host can still write to `handle.session` and call `setDocument`. */
  readOnly?: boolean;
  /** `"auto"` (default) follows `(pointer: coarse)`. */
  density?: OpfEditorDensity | "auto";
  /** `"auto"` (default) shows the sheet at 900px and under. */
  exportMode?: "menu" | "sheet" | "auto";
  theme?: OpfEditorTheme;
  /**
   * Text for the default layouts (`review`, `design`, `find`, `undo`, `redo`, `slideView`, `inspector`) and the accessible names of the slide row's
   * two landmarks (`navigator`, default "Slide navigation"; `thumbnails`, default "Slides").
   */
  labels?: Partial<Record<"review" | "design" | "find" | "undo" | "redo" | "slideView" | "inspector" | "navigator" | "thumbnails", string>>;
  /**
   * Which slide stays on show when the document changes outside the canvas: `"id"` (default) follows the slide by its id (a reorder in the source
   * pane keeps it), `"position"` keeps the position and clamps it to the deck.
   */
  slideRetention?: "id" | "position";
  /** Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z outside text fields (default true). */
  shortcuts?: boolean;

  onChange?(detail: OpfEditorEvents["change"]): void;
  onSelection?(detail: OpfEditorEvents["selection"]): void;
  /** The caret of the source pane moved to another place in the text. The same as `on: { cursor }`. */
  onCursor?(detail: OpfEditorEvents["cursor"]): void;
  onError?(error: Error, detail: Omit<OpfEditorEvents["error"], "error">): void;
  onReady?(detail: OpfEditorEvents["ready"]): void;
  /** Listeners by event name; the same as calling `on` before anything happens. */
  on?: { [Name in keyof OpfEditorEvents]?: (detail: OpfEditorEvents[Name]) => void };
}

export interface OpfEditorSourceState {
  /** `valid`, `invalid` (the document has errors) or `syntax` (the text does not read as a document in `format`). */
  status: { kind: "valid"; warnings: number } | { kind: "invalid"; errors: number; warnings: number } | { kind: "syntax"; format: SourceFormat; message: string };
  format: SourceFormat;
  text: string;
}

export interface OpfEditorEvents {
  /** The parts are mounted (the fonts handle arrived); the first update, which may wait for the faces the document needs, has not run yet. */
  mounted: { editor: OpfEditor };
  /** The first update has run: the document has been checked against the fonts it needs, and the parts show it. */
  ready: { editor: OpfEditor };
  /** The document changed (an edit in the canvas or the source, undo, redo, a loaded document). Not fired for a catalogs change. */
  change: { document: unknown; canUndo: boolean; canRedo: boolean; event: EditorEvent };
  /** The canvas's selection; in the Studio, the list (`items`, the `primary` and what changed it: `canvas`, `layers`, `keyboard`, `source`, ...). */
  selection: { path: string | undefined; value: unknown; slideIndex: number; element?: Element | undefined; items?: OpfStudioSelectionItem[]; primary?: OpfStudioSelectionItem | null; source?: string };
  /** CE-20: the Studio's zoom changed (a factor of the fitted slide). */
  zoom: { zoom: number };
  /** CE-20: the Studio switched preset. */
  layout: { layout: "studio" | "playground"; previous: "studio" | "playground" };
  /** CE-20: a Studio command ran (`ok` false when it was off; `reason` says why). */
  command: { id: string; ok: boolean; reason?: string };
  /** CE-20: Layout Studio was opened from "Edit layout", or closed. */
  layoutStudio: { open: boolean; recordId: string };
  /**
   * The caret or selection of the source pane moved, in JSON, YAML or Markdown, also while the pane has no focus: the path under it as a JSON Pointer
   * and by id, and the selection in source offsets. Quiet for `source.cursorDelay` first and not repeated for a place already reported; the detail is
   * frozen. For the rest of the pane (`revealPath`, `setDecorations`, `getCursor`) use `editor.sourcePane`.
   */
  cursor: SourceCursor;
  /** The slide changed (0-based). */
  slide: { index: number; count: number };
  view: { view: OpfEditorView; previous: OpfEditorView };
  /** The text of the source pane was checked: the verdict about the text it shows. */
  source: OpfEditorSourceState;
  /** The pane has text it has not applied yet (`true`), or has caught up. */
  checking: { checking: boolean };
  fonts: { state: "loading"; pending?: string[] } | { state: "ready" } | { state: "error"; error: Error };
  /** The slide was drawn at this size (the slide's own units). */
  geometry: { width: number; height: number };
  /** After every update once the fonts are ready: the document, the slide on show, its geometry and layout notes (computed when read). */
  sync: { presentation: any; slideIndex: number; count: number; readonly geometry: any; readonly diagnostics: { path: string; message: string }[] };
  /** The canvas drew a slide. */
  render: { presentation: unknown; slideIndex: number; svg: SVGSVGElement; geometry: any; draft: boolean };
  /** An inline edit in the canvas: a draft that is not in the document yet, its commit, or its cancel. */
  draft: { presentation: unknown; path: string; value: unknown };
  commit: { path: string; editor: EditorSession };
  cancel: { path?: string };
  status: { message: string };
  error: { error: Error; message: string; [key: string]: unknown };
  /** The source was copied or downloaded (or exported as JSON, YAML or Markdown): it is kept somewhere of the person's own. */
  kept: { kind: "copy" | "download" };
  rename: { name: string };
  export: { blob: Blob; fileName: string; format: string; notes: string[] };
  persistence: AutosaveStatus;
  review: { error: number; warning: number; info: number; total: number; all: number; sources: string[]; unavailable: boolean };
  /** A Review finding about the deck rather than a slide asked to be shown. */
  "review-goto": { finding: ReviewFinding; target: unknown };
  "review-focus": { fix: unknown; target: unknown };
  panel: { panel: "review" | "design" };
  destroy: Record<string, never>;
}

export interface OpfEditorSetDocumentOptions {
  /** The document as written (its JSON, or a YAML or Markdown file's text). The source pane shows it as it is, and a JSON file that is not changed is downloaded with its own bytes (line endings included). */
  text?: string;
  /** Switch the source pane to this format first. */
  format?: SourceFormat;
  /** The file name the pane uses. */
  name?: string;
  /** Treat the loaded document as the starting point of autosave (default true): it is not stored or warned about until edited. */
  rebase?: boolean;
}

export interface OpfEditor {
  /** The mount element and the node the editor built inside it. */
  readonly element: HTMLElement;
  readonly root: HTMLElement;
  /** Settles when the parts are mounted and the first update is done; rejects when the fonts could not be obtained. */
  readonly ready: Promise<OpfEditor>;
  readonly destroyed: boolean;
  readonly mounted: boolean;
  readonly session: EditorSession;
  readonly canvas: CanvasEditor | undefined;
  readonly sourcePane: SourcePane | undefined;
  readonly presenter: Presenter | undefined;
  readonly exportMenu: ExportMenu | undefined;
  readonly review: ReviewPanel | undefined;
  readonly find: (FindPanel & { openPanel(options?: { replace?: boolean; query?: string }): void }) | undefined;
  readonly design: DesignControls | undefined;
  readonly persistence: Persistence | undefined;
  readonly slideManager: SlideManager | undefined;
  readonly layoutStudio: LayoutStudio | undefined;
  readonly fonts: EditorFonts | undefined;
  readonly slideIndex: number;
  /** The content last selected on the canvas; in the Studio, the selection list. */
  readonly selection: { path: string; value: unknown } | OpfStudioSelectionItem[] | null;
  /** CE-20: the arrangement; `setLayout` switches the Studio between "studio" and "playground". */
  readonly layout: OpfEditorLayout | "slots";
  setLayout(layout: "studio" | "playground"): boolean;
  /** CE-20: the Studio's zoom (1 is the slide fitted), `setZoom` and `fit` ("slide" or "width"). */
  readonly zoom: number;
  setZoom(zoom: number): void;
  fit(mode?: "slide" | "width"): void;
  /** CE-20: "Edit layout": open a layout of the slide (default the current slide's) in Layout Studio, forked into the deck when it comes from a catalog. */
  openLayout(layoutId?: string, options?: { slide?: number }): boolean;
  /** CE-20: the Studio's command registry; empty outside the Studio. */
  readonly commands: { list(): OpfCommandInfo[]; run(id: string): boolean; register(command: OpfCommand): () => void };
  readonly view: OpfEditorView;
  readonly views: OpfEditorView[];
  readonly readOnly: boolean;
  /** False while the text in the source pane is not a valid deck: the slide shows the last valid one. */
  readonly inSync: boolean;
  /** The latest `cursor` event, or `null` before the first (and without a source pane). The same object until the next event. */
  readonly sourceCursor: SourceCursor | null;
  /** The latest verdict on the text of the source pane (what the last `source` event carried), or `null` before the first. */
  readonly sourceState: OpfEditorSourceState | null;
  readonly lastError: Error | undefined;
  readonly slots: OpfEditorSlots;
  /** The document. Frozen and replaced on every change, so it works as a store snapshot. */
  getDocument(): unknown;
  /**
   * Open a different document as one undoable change that forks none of the catalog records it embeds. With a source pane it shows `options.text`
   * as written. A document the session refuses is listed in the pane as a draft and `false` is returned. Throws before `ready`.
   */
  setDocument(document: unknown, options?: OpfEditorSetDocumentOptions): boolean;
  /**
   * Load raw source text into the source pane without converting it (a file as it was read, text that does not parse): what pasting it over
   * everything does. `options.format` is the text's format (the pane switches to it), `options.name` the file name, `options.rebase` as in
   * `setDocument` (only when the text applied). Text that reads as a document the session accepts is applied as one undoable change; anything
   * else stays in the pane as a draft with its problems (the slide keeps the last valid document) and `false` is returned. An open canvas edit
   * is committed first. Throws before `ready`, without a source pane, and while read-only.
   */
  setSourceText(text: string, options?: Omit<OpfEditorSetDocumentOptions, "text">): boolean;
  /** Switch the view. Commits an open canvas edit first; false when that failed or the view is not available. */
  setView(view: OpfEditorView, options?: { focus?: boolean }): boolean;
  /** Show slide `index` (0-based). Commits an open canvas edit first. */
  setSlide(index: number): boolean;
  /** Run the update again now: the parts redraw and `sync` is emitted once the fonts are ready. Resolves when it is done. */
  refresh(): Promise<void>;
  /** Resolves when the latest update has finished (fonts loaded, parts redrawn). */
  whenIdle(): Promise<void>;
  /** Show a slide and select the content at `path` on it. */
  goTo(index: number, path?: string): boolean;
  /** Select the content at `path` on the current slide (or the closest content that can be selected); returns the path selected. */
  /** Select content by path (the canvas: returns the path it selected). In the Studio: scene keys or paths, several siblings at once; returns whether all were found. */
  select(path: string | string[], options?: { focus?: boolean }): string | null | boolean;
  showPanel(panel: "review" | "design", focus?: boolean): boolean;
  /** Start the full-screen presentation at the slide on show. False when it cannot start (invalid source, no slides, already running). */
  /** Present from the slide on show (or from `from`, 0-based). */
  present(from?: number): boolean;
  undo(): boolean;
  redo(): boolean;
  /** Commit an open canvas edit. False when it could not be committed. */
  commit(): boolean;
  focus(target?: "source" | "canvas"): boolean;
  openFind(options?: { replace?: boolean; query?: string }): boolean;
  /** The text of the source pane with any pending edit applied, and whether it is a draft the document did not take. */
  readSource(): { text: string; format: SourceFormat; draft: boolean };
  setName(name: string): void;
  getName(): string | undefined;
  setReadOnly(readOnly: boolean): void;
  setTheme(theme: OpfEditorTheme | undefined): NormalizedTheme;
  setDensity(density: OpfEditorDensity | "auto"): void;
  setExportMode(mode: "menu" | "sheet" | "auto"): void;
  /** Write a message on the status line (and to `status` listeners). */
  status(message: string): void;
  /** Listen to an event. Returns a function that stops listening. */
  on<Name extends keyof OpfEditorEvents>(name: Name, listener: (detail: OpfEditorEvents[Name]) => void): () => void;
  off<Name extends keyof OpfEditorEvents>(name: Name, listener: (detail: OpfEditorEvents[Name]) => void): void;
  /** Remove every part, listener, observer and the built DOM, release the fonts lease and the theme. Safe to call twice and before `ready`. */
  destroy(): void;
}

/**
 * Mount the editor in `element` (its content is replaced). The parts mount once the fonts have arrived and, for a layout that shows slides,
 * once the slide chunk (the renderer and the slide parts, imported on demand) has loaded; await `ready`. A source-only editor never loads that chunk.
 */
export declare function createOpfEditor(element: HTMLElement, options?: OpfEditorOptions): OpfEditor;

export type { LayoutStudio } from "./workspace-layouts.js";
