import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** One section of the deck: a maximal run of consecutive slides sharing a `section` label (or none). */
export interface SlideSection {
  /** Position in `listSections(presentation)`, the id every section operation takes. */
  index: number;
  /** The label; undefined for the unnamed run of slides with no label. */
  name: string | undefined;
  unnamed: boolean;
  /** Index of the first slide and how many slides the run holds. */
  start: number;
  count: number;
}
export interface SlideSummary { index: number; id?: string; title: string; hidden: boolean; section?: string; layout?: string }

/** What every `prepare*` function returns without touching a session. Empty `patches` and `changed: false` mean nothing to do. */
export interface PreparedSlideChange {
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  /** The slide indices to select after the change (the new, moved or remaining slides). */
  selection: number[];
  action?: string;
  /** add: the index and id of the new slide. */
  index?: number;
  id?: string;
  layout?: string;
  /** duplicate: where the copies start and how many there are, and their ids. */
  range?: { start: number; count: number };
  ids?: (string | undefined)[];
  /** remove: the removed slide indices (original order). */
  removed?: number[];
  /** move: the new order as old slide indices. */
  order?: number[];
  /** hide and show. */
  hidden?: boolean;
  /** Section operations: the label now on the slides. */
  section?: string;
}
/** The session change of an applied operation, with the same report fields. One undo step; an unchanged operation commits nothing. */
export interface SlideChange extends Omit<EditorChange, "presentation" | "patches">, Omit<PreparedSlideChange, "presentation" | "patches"> {
  presentation: unknown;
  patches: JsonPatchOperation[];
}

/** How moved slides take a section: the neighbour's (`"adopt"`, default), none of that (`"keep"`), a named one or none (`null`). */
export type MoveSectionMode = "adopt" | "keep" | string | null;
export interface AddSlideOptions {
  /** The index the slide takes (default: the end). */
  at?: number;
  /** A layouts catalog id; the layout's placeholders are added as empty slots. */
  layout?: string;
  title?: string;
  text?: string;
  id?: string;
  /** Default: the section of the slide before the new one. Pass null for none. */
  section?: string | null;
  /** A ready-made slide to insert instead of a blank one. */
  slide?: Record<string, unknown>;
  catalogs?: Record<string, unknown>;
  record?: Record<string, unknown>;
}

export declare function listSections(presentation: unknown): SlideSection[];
export declare function hasSections(presentation: unknown): boolean;
export declare function sectionForSlide(presentation: unknown, slideIndex: number): SlideSection | undefined;
export declare function slideTitle(slide: unknown): string;
export declare function slideSummaries(presentation: unknown): SlideSummary[];

export declare function prepareAddSlide(presentation: unknown, options?: AddSlideOptions): PreparedSlideChange;
export declare function addSlide(editor: EditorSession, options?: AddSlideOptions, meta?: Record<string, unknown>): SlideChange;
export declare function prepareDuplicateSlides(presentation: unknown, indices: number | number[], options?: { section?: "keep" }): PreparedSlideChange;
export declare function duplicateSlides(editor: EditorSession, indices: number | number[], options?: { section?: "keep" }, meta?: Record<string, unknown>): SlideChange;
/** Throws `cannot-remove-all-slides` when every slide is chosen. */
export declare function prepareRemoveSlides(presentation: unknown, indices: number | number[]): PreparedSlideChange;
export declare function removeSlides(editor: EditorSession, indices: number | number[], meta?: Record<string, unknown>): SlideChange;
/** `to` is the drop gap in the original order (0 to the slide count). */
export declare function prepareMoveSlides(presentation: unknown, indices: number | number[], to: number, options?: { section?: MoveSectionMode }): PreparedSlideChange;
export declare function moveSlides(editor: EditorSession, indices: number | number[], to: number, options?: { section?: MoveSectionMode }, meta?: Record<string, unknown>): SlideChange;
export declare function prepareMoveSlidesBy(presentation: unknown, indices: number | number[], delta: number, options?: { section?: MoveSectionMode }): PreparedSlideChange;
export declare function moveSlidesBy(editor: EditorSession, indices: number | number[], delta: number, options?: { section?: MoveSectionMode }, meta?: Record<string, unknown>): SlideChange;
/** `hidden` omitted toggles: all hidden become shown, otherwise all become hidden. */
export declare function prepareSetHidden(presentation: unknown, indices: number | number[], hidden?: boolean): PreparedSlideChange;
export declare function setHidden(editor: EditorSession, indices: number | number[], hidden?: boolean, meta?: Record<string, unknown>): SlideChange;
export declare function prepareSetSection(presentation: unknown, indices: number | number[], name: string | null): PreparedSlideChange;
export declare function setSection(editor: EditorSession, indices: number | number[], name: string | null, meta?: Record<string, unknown>): SlideChange;
export declare function prepareAddSection(presentation: unknown, slideIndex: number, name: string): PreparedSlideChange;
export declare function addSection(editor: EditorSession, slideIndex: number, name: string, meta?: Record<string, unknown>): SlideChange;
export declare function prepareRenameSection(presentation: unknown, sectionIndex: number, name: string): PreparedSlideChange;
export declare function renameSection(editor: EditorSession, sectionIndex: number, name: string, meta?: Record<string, unknown>): SlideChange;
export declare function prepareRemoveSection(presentation: unknown, sectionIndex: number, options?: { deleteSlides?: boolean }): PreparedSlideChange;
export declare function removeSection(editor: EditorSession, sectionIndex: number, options?: { deleteSlides?: boolean }, meta?: Record<string, unknown>): SlideChange;
/** `to` is a gap among the sections (0 to the section count). */
export declare function prepareMoveSection(presentation: unknown, sectionIndex: number, to: number): PreparedSlideChange;
export declare function moveSection(editor: EditorSession, sectionIndex: number, to: number, meta?: Record<string, unknown>): SlideChange;
export declare const SLIDE_OPERATIONS: Readonly<Record<string, (presentation: unknown, ...args: any[]) => PreparedSlideChange>>;
