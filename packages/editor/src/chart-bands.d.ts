import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** The scheme colors a band may take (the schema's SchemeColorName). */
export declare const BAND_COLORS: readonly string[];
/** The most bands a chart takes. */
export declare const MAX_BANDS: 6;
export interface ChartBandState { to: number; label: string | undefined; color: string | undefined }
/** The chart path a selection path points at, or undefined. */
export declare function parseChartPath(path: string): string | undefined;
/** A chart's bands as form state: whether its type draws bands, and the bands as written. */
export declare function readChartBands(chart: unknown): { supported: boolean; bands: ChartBandState[] };
export interface ChartBandInput { to: number; label?: string; color?: string }
export interface PreparedChartBands { action: "chart-bands"; chartPath: string; changed: boolean; patches: JsonPatchOperation[]; presentation: unknown }
/** Prepare a change of a chart's bands (the whole new list; `[]` or `null` removes them); nothing is applied. */
export declare function prepareChartBands(presentation: unknown, chartPath: string, bands: ChartBandInput[] | null): PreparedChartBands;
type BandsChange = EditorChange & { action: "chart-bands"; chartPath: string; changed: boolean };
/** Apply a change of a chart's bands to an editor session as one undoable edit. */
export declare function setChartBands(editor: EditorSession, chartPath: string, bands: ChartBandInput[] | null, meta?: Record<string, unknown>): BandsChange;
/** Add a band above the last one (or the given band). */
export declare function addChartBand(editor: EditorSession, chartPath: string, band?: ChartBandInput): BandsChange;
/** Remove band `index`. */
export declare function removeChartBand(editor: EditorSession, chartPath: string, index: number): BandsChange;
/** Move band `index` by `offset` (-1 or 1). */
export declare function moveChartBand(editor: EditorSession, chartPath: string, index: number, offset: number): BandsChange;
