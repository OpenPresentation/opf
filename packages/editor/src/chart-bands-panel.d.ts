import type { EditorSession } from "./index.js";

export interface ChartBandsPanel { element: HTMLElement; refresh(): void; destroy(): void }
/** A band end as the value axis shows it (a percent format as a percentage). */
export declare function formatBandEnd(value: number, format?: string): string;
/** A typed band end ("60%" is 0.6), or undefined when it is not a number. */
export declare function parseBandEnd(text: string): number | undefined;
/** Mount the Bands section in `host`; it shows itself while a chart whose type draws bands is selected. */
export declare function createChartBandsPanel(host: HTMLElement, options: { editor: EditorSession; getSelectedPath: () => string | undefined; onStatus?: (message: string) => void }): ChartBandsPanel;
