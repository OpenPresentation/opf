import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** Whether a slide is drawn right to left, so its overlays' `x` counts from the right edge (from its language, else the deck's). */
export declare function slideIsRtl(presentation: unknown, slideIndex: number): boolean;
/** How a connector draws between its ends. */
export declare const CONNECTOR_ROUTES: readonly ["straight", "elbow", "curved"];
export type ConnectorRoute = (typeof CONNECTOR_ROUTES)[number];
/** The ways to restack an overlay. */
export declare const OVERLAY_LAYER_MOVES: readonly ["front", "forward", "backward", "back"];
export type OverlayLayerMove = (typeof OVERLAY_LAYER_MOVES)[number];

/** The overlay entry (shape or connector) a selection is in, as `slides.N.shapes.I`, or undefined. */
export declare function overlayPathForSelection(presentation: unknown, selectedPath: string): string | undefined;
export interface OverlayState {
  path: string;
  slideIndex: number;
  index: number;
  /** How many overlays the slide has. */
  count: number;
  kind: "shape" | "connector";
  /** `fractions` (x, y, width, height), `at` (attached to a block) or `none` (a connector). */
  placement: "fractions" | "at" | "none";
  /** A copy of the entry. */
  entry: Record<string, unknown>;
}
/** The overlay a path (or a selection inside it) names, or undefined. */
export declare function readOverlay(presentation: unknown, selectedPath: string): OverlayState | undefined;

export interface PreparedOverlayChange { presentation: unknown; patches: JsonPatchOperation[]; changed: boolean; path: string }
export type OverlayChange = EditorChange & { changed: boolean; path: string };
export interface OverlayFrame { x: number; y: number; width: number; height: number }

export interface OverlayInsertOptions {
  slideIndex: number;
  shape: string;
  /** The frame in fractions of the slide; else about a fifth of the slide wide at the preset's proportions, centered on `center`. */
  frame?: OverlayFrame;
  /** Explicit finite signed center in the overlay start-edge convention; may cross the slide. Omission keeps gallery insertion visible. */
  center?: { x: number; y: number };
  /** The slide's pixel size for those proportions (default 1280 by 720). */
  size?: { width: number; height: number };
  /** More keys for the entry: `{ text: "New", fill: "accent2" }`. */
  block?: Record<string, unknown>;
}
export declare function prepareOverlayInsert(presentation: unknown, options: OverlayInsertOptions): PreparedOverlayChange & { shape: string; frame: OverlayFrame };
/** Add an overlay shape on top of a slide as one undoable step; the change's `path` is the new entry. */
export declare function insertOverlayShape(editor: EditorSession, options: OverlayInsertOptions, meta?: Record<string, unknown>): OverlayChange & { shape: string; frame: OverlayFrame };

/** An anchor: `width` and `height` are fractions of the target (the block, or with `point` the chart mark; 1 is its own size), `widthPx` and `heightPx` reference pixels; one of the two for each side. */
export interface OverlayAnchor {block: string; edge: "top" | "bottom" | "start" | "end" | "center"; point?: string | number; series?: string | number; offset?: number; width?: number; height?: number; widthPx?: number; heightPx?: number}
export declare function prepareOverlayAnchor(presentation: unknown, path: string, anchor: OverlayAnchor): PreparedOverlayChange;
/** Attach a shape to a block or chart point as one validated, undoable change. */
export declare function setOverlayAnchor(editor: EditorSession, path: string, anchor: OverlayAnchor, meta?: Record<string, unknown>): OverlayChange;
export interface ChartPointTarget {id: string; path: string; label: string; points: {index: number; name: string}[]; series: {index: number; name: string}[]}
export declare function listChartPointTargets(presentation: unknown, slideIndex: number): ChartPointTarget[];
/** A frame change: signed x/y fractions and width/height fractions subject to finite representable geometry for a shape placed by `x`, `y`, `width` and `height`; for one attached to a block `offset` (pixels), `width`/`height` (fractions of the target) or `widthPx`/`heightPx` (reference pixels; setting one unit removes the other). */
export interface OverlayFrameChange { x?: number; y?: number; width?: number; height?: number; widthPx?: number; heightPx?: number; offset?: number }
export declare function prepareOverlayFrame(presentation: unknown, path: string, change: OverlayFrameChange): PreparedOverlayChange;
/** Move or resize an overlay shape as one undoable step. An attached shape keeps its `at`; `x` or `y` on it throws `overlay-anchored`. */
export declare function setOverlayFrame(editor: EditorSession, path: string, change: OverlayFrameChange, meta?: Record<string, unknown>): OverlayChange;
export declare function prepareOverlayDetach(presentation: unknown, path: string, frame: OverlayFrame): PreparedOverlayChange;
/** Free an attached overlay shape from its block as one undoable step; `frame` is where it is now, in fractions of the slide. */
export declare function detachOverlay(editor: EditorSession, path: string, frame: OverlayFrame, meta?: Record<string, unknown>): OverlayChange;

export declare function prepareOverlayLayer(presentation: unknown, path: string, where: OverlayLayerMove): PreparedOverlayChange & { index: number };
/** Bring an overlay forward or send it backward (array order: later is on top) as one undoable step; the change's `path` is its new place. */
export declare function moveOverlayLayer(editor: EditorSession, path: string, where: OverlayLayerMove, meta?: Record<string, unknown>): OverlayChange & { index: number };
export declare function prepareOverlayRemove(presentation: unknown, path: string): PreparedOverlayChange & { removed: string[] };
/** Delete an overlay shape (and the connectors that end on it) or a connector as one undoable step. */
export declare function removeOverlay(editor: EditorSession, path: string, meta?: Record<string, unknown>): OverlayChange & { removed: string[] };

export interface ConnectionEnd { path: string; kind: "block" | "shape"; id?: string; label: string }
/** What a connector can join on a slide: its blocks and its overlay shapes. */
export declare function listConnectionEnds(presentation: unknown, slideIndex: number): ConnectionEnd[];
export interface ConnectOptions {
  slideIndex: number;
  /** The paths of the two ends (a selection inside one works). */
  from: string;
  to: string;
  route?: ConnectorRoute;
  /** The usual line keys, for example `{ end: { type: "triangle" } }`. */
  stroke?: Record<string, unknown>;
}
export declare function prepareConnect(presentation: unknown, options: ConnectOptions): PreparedOverlayChange & { from: string; to: string };
/** Join two blocks or overlay shapes with a connector as one undoable step; an end with no `id` gets one in the same patch. */
export declare function connectShapes(editor: EditorSession, options: ConnectOptions, meta?: Record<string, unknown>): OverlayChange & { from: string; to: string };
export interface ConnectorChange { route?: ConnectorRoute | null; from?: string; to?: string; fromSite?: number | null; toSite?: number | null }
export declare function prepareConnectorChange(presentation: unknown, path: string, change: ConnectorChange): PreparedOverlayChange;
/** Change a connector's route, ends or sites as one undoable step. */
export declare function setConnector(editor: EditorSession, path: string, change: ConnectorChange, meta?: Record<string, unknown>): OverlayChange;
