import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export type CaptionPosition = "below" | "above";
export type CaptionAlignment = "left" | "center" | "right";
export type RichText = string | ReadonlyArray<string | Record<string, unknown>>;
export interface CaptionSettings { text: RichText; position: CaptionPosition; align: CaptionAlignment }
export type CaptionInput = RichText | { text: RichText; position?: CaptionPosition; align?: CaptionAlignment };
export interface Reference { id: string; text: RichText; url?: string }

export declare const CAPTION_POSITIONS: readonly ["below", "above"];
export declare const CAPTION_ALIGNMENTS: readonly ["left", "center", "right"];
export declare const CAPTIONABLE_FIELDS: readonly ["image", "chart", "table", "video"];

export interface PreparedAnnotationChange {
  action: "caption" | "add-reference" | "update-reference" | "remove-reference" | "cite" | "uncite" | "footnote";
  /** The edited container path (the block, `references`, or the run array). */
  path: string;
  /** The validated candidate document. */
  presentation: Record<string, unknown>;
  /** A test guard plus one replace; empty when nothing changes. */
  patches: JsonPatchOperation[];
  changed: boolean;
  field?: string;
  id?: string;
  runPath?: string;
  ids?: string[];
  removedCites?: string[];
}
export type AnnotationChange = (EditorChange & Omit<PreparedAnnotationChange, "presentation" | "patches">) | PreparedAnnotationChange;

export interface CaptionTarget { blockPath: string; field: string; caption?: CaptionSettings }
export interface CaptionState { blockPath: string; field: string; caption?: CaptionSettings }
export interface ReferenceState { index: number; id: string; text: RichText; url?: string; cited: boolean; number?: number }
export interface CitationNoteState { number: number; kind: "reference" | "footnote"; id?: string; text: RichText; sourcePath: string; url?: string; resolved: boolean }
export interface CitationState {
  notes: CitationNoteState[];
  references: CitationNoteState[];
  unused: string[];
  slides: { slideIndex: number; markers: { path: string; text: string; numbers: number[] }[]; notes: number[] }[];
}

/** Normalize a caption value to `{ text, position, align }`, or undefined. */
export declare function normalizeCaption(value: unknown): CaptionSettings | undefined;
/** Every block (and one-payload slide root) that can carry a caption, with its current caption. */
export declare function captionTargets(presentation: unknown): CaptionTarget[];
export declare function readCaption(presentation: unknown, blockPath: string | string[]): CaptionState;
export declare function prepareCaption(presentation: unknown, blockPath: string | string[], caption: CaptionInput | null): PreparedAnnotationChange;
export declare function setCaption(editor: EditorSession, blockPath: string | string[], caption: CaptionInput | null, meta?: Record<string, unknown>): AnnotationChange;

export declare function listReferences(presentation: unknown): ReferenceState[];
export declare function prepareReference(presentation: unknown, reference: Reference): PreparedAnnotationChange;
export declare function addReference(editor: EditorSession, reference: Reference, meta?: Record<string, unknown>): AnnotationChange;
export declare function prepareReferenceUpdate(presentation: unknown, id: string, fields: { text?: RichText; url?: string | null }): PreparedAnnotationChange;
export declare function updateReference(editor: EditorSession, id: string, fields: { text?: RichText; url?: string | null }, meta?: Record<string, unknown>): AnnotationChange;
/** Refuses while a run cites the id unless `force`, which also removes those cites. */
export declare function prepareReferenceRemoval(presentation: unknown, id: string, options?: { force?: boolean }): PreparedAnnotationChange;
export declare function removeReference(editor: EditorSession, id: string, options?: { force?: boolean }, meta?: Record<string, unknown>): AnnotationChange;

/** The run at a run path (`slides.0.text.2`): its run array path segments, index and value. */
export declare function runAt(presentation: unknown, runPath: string | string[]): { parts: string[]; index: number; run: string | Record<string, unknown> };
export declare function prepareCite(presentation: unknown, runPath: string | string[], ids: string | string[]): PreparedAnnotationChange;
export declare function citeRun(editor: EditorSession, runPath: string | string[], ids: string | string[], meta?: Record<string, unknown>): AnnotationChange;
export declare function prepareUncite(presentation: unknown, runPath: string | string[]): PreparedAnnotationChange;
export declare function unciteRun(editor: EditorSession, runPath: string | string[], meta?: Record<string, unknown>): AnnotationChange;
export declare function prepareFootnote(presentation: unknown, runPath: string | string[], text: RichText | null): PreparedAnnotationChange;
export declare function setFootnote(editor: EditorSession, runPath: string | string[], text: RichText | null, meta?: Record<string, unknown>): AnnotationChange;

/** The deck numbering the engines draw (core `collectCitations`). */
export declare function listCitations(presentation: unknown): CitationState;
/** An ordinary list slide of the cited references (core `referencesSlide`). */
export declare function referencesSlideFor(presentation: unknown, options?: { title?: string }): Record<string, unknown>;
