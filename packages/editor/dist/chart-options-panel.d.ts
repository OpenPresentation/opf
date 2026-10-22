import type { EditorSession } from "./index.js";

export interface ChartOptionsPanelOptions {
  editor: EditorSession;
  /** The selected OPF path; any path inside a chart selects it. */
  getSelectedPath: () => string | undefined;
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
