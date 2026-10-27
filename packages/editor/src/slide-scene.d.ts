/** CE-19 (internal; no package subpath exports it yet): the slide scene model, one slide of a deck as the studio kit sees it. */
import type { SlideComposition } from "@openpresentation/opf/composition";

/** A box in slide units: 0 to 1 across the slide's width and height. */
export interface SceneBox { x: number; y: number; w: number; h: number }
export interface SceneTrack { start: number; length: number; weight: number }
/** A container's arrangement: its tracks along `direction`, for dividers and drop lines. */
export interface SceneContainer {
  mode: "auto" | "grid" | "row" | "column" | "region" | "layout";
  direction: "row" | "column";
  columns: number;
  rows: number;
  tracks: SceneTrack[];
  gap: number;
  padding: number;
  /** Whether a divider drag can resize the tracks (`composition.weights`). */
  resizable: boolean;
  /** The composed flow's path, when the container has one. */
  flowPath?: string;
  /** The slide's content is in promoted regions (`left`, `center+right`, ...): drops go into a region. */
  promoted?: boolean;
  /** The slide uses a layout template: its regions are its children. */
  layout?: boolean;
}
export interface SceneCan { move: boolean; group: boolean; delete: boolean; duplicate: boolean; resizeTracks: boolean }
export interface SceneFinding { message: string; code?: string; severity?: string; path: string }
export type SceneNodeKind = "slide" | "heading" | "region" | "group" | "block" | "part" | "implicit";
export interface SceneNode {
  /** The id path (`/slides/@intro/blocks/@kpi`; an element without an id keeps its index); a layout region is `<slide key>#<name>`. */
  key: string;
  /** The index JSON Pointer now (a layout region's is its slide's). */
  path: string;
  kind: SceneNodeKind;
  /** The content kind (`text`, `chart`, ...), `group`, `region`, `slide`, or the heading field (`title`, `subtitle`, `tag`). */
  type: string;
  parent: string | null;
  /** The index in the parent's children. */
  index: number;
  depth: number;
  /** "Text: Start with a clear…", "Row · 3", "Region media", "Title", "Slide 3 · two-column". */
  label: string;
  box?: SceneBox;
  container?: SceneContainer;
  findings: SceneFinding[];
  can: SceneCan;
  children: string[];
  /** A block's index in its `blocks` array; an implicit field's index among its owner's content fields (its block index once converted). */
  blockIndex?: number;
  /** A root block's layout region pin. */
  pin?: string;
  /** A layout region: it has no place in the document. */
  virtual?: boolean;
  /** A promoted region of the slide grid. */
  promoted?: boolean;
  /** The region's name. */
  region?: string;
  accepts?: string[];
  max?: number;
  collapsed?: boolean;
  /** Implicit content: its field and the pointer of the object that holds it. */
  field?: string;
  owner?: string;
  hidden?: boolean;
}
export interface SceneHit extends SceneBox { depth: number; key: string; node: SceneNode }
export interface SlideScene {
  slideIndex: number;
  slideKey: string;
  width: number;
  height: number;
  /** Uses a layout template (its regions are the slide's children). */
  layout: boolean;
  nodes: SceneNode[];
  node(key: string): SceneNode | undefined;
  nodeAtPath(path: string): SceneNode | undefined;
  children(key: string): SceneNode[];
  contentChildren(key: string): SceneNode[];
  boxOf(key: string): (SceneBox & { depth: number }) | undefined;
  containerOf(key: string): SceneContainer | undefined;
  flowOf(key: string): SlideComposition["flows"][number] | undefined;
  hitChain(point: { x: number; y: number }, options?: { parts?: boolean; skip?(hit: SceneHit): boolean }): SceneHit[];
  target(chain: SceneHit[], options?: { primary?: string | null; shift?: boolean; deep?: boolean }): SceneHit | null;
  survivor(key: string): string | null;
}
export interface SceneDrop {
  target: string;
  index: number;
  into: string | null;
  line: { x: number; y: number; w: number; h: number; orientation: "vertical" | "horizontal" };
}
export declare const CONTENT_FIELDS: readonly string[];
export declare function isPromotedRegion(key: string): boolean;
export declare function contentFieldsOf(owner: unknown): string[];
export declare function describeBlock(block: unknown): string;
export declare function slideScene(presentation: unknown, slideIndex: number, options: { geometry: SlideComposition; findings?: { path: string; message: string; code?: string; severity?: string }[]; parts?: boolean }): SlideScene;
export declare function dropTarget(scene: SlideScene, point: { x: number; y: number }, keys?: string[], options?: { edge?: number }): SceneDrop | null;
