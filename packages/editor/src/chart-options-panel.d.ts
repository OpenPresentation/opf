import type { EditorSession } from "./index.js";

export interface ChartOptionsPanelOptions {
  editor: EditorSession;
  /** The selected OPF path; any path inside a chart selects it. */
  getSelectedPath: () => string | undefined;
  /** LH-100: the slide's composition as the canvas drew it (`{ items }`); the panel reads the chart layer core composed. Without it the panel composes the slide through the session. */
  getGeometry?: (slideIndex: number) => { items: ReadonlyArray<{ path: string; field: string; chart?: { layer?: unknown } }> } | undefined;
  onStatus?: (message: string) => void;
}
export interface ChartOptionsPanel {
  /** The panel's root element (hidden while no chart is selected). */
  element: HTMLElement;
  /** Re-read the selection and the chart; the panel also refreshes on every editor change. */
  refresh(): void;
  destroy(): void;
}
export declare function createChartOptionsPanel(host: HTMLElement, options: ChartOptionsPanelOptions): ChartOptionsPanel;
