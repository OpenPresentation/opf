import type { EditorSession } from "./index.js";

export interface TableColorScalePanel { element: HTMLElement; refresh(): void; destroy(): void }
/** Mount the color scale panel in `host`; it shows itself while a table is selected. */
export declare function createTableColorScalePanel(host: HTMLElement, options: { editor: EditorSession; getSelectedPath: () => string | undefined; onStatus?: (message: string) => void }): TableColorScalePanel;
