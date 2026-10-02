import type { AutosaveStatus, RestoreChoice, RestoreOffer } from "./persistence.js";

export interface PersistenceUiOptions {
  /** The element the restore prompt is drawn in (hidden when there is nothing to offer). */
  banner?: HTMLElement;
  /** An element for the one-line autosave status ("Saved on this device at 2:03 PM", or why autosave is off). */
  indicator?: HTMLElement;
  locale?: string;
  /** Appended to the status sentence in the indicator (for example "Save an OPF file to keep a copy."). */
  suffix?: string;
  /** What the indicator shows until storage reports (and when a status has no sentence); lines are split on a newline. */
  fallback?: string;
  /** Wired to `persistence.restoreEarlier` for the "Restore older copy" button. */
  restoreEarlier?: () => Promise<boolean>;
}
export interface PersistenceUi {
  /** Pass as `onRestorePrompt` of `createPersistence`. */
  prompt(offer: RestoreOffer, actions: { restore(): Promise<boolean>; discard(): Promise<boolean> }): RestoreChoice;
  /** Pass as `onStatus` of `createPersistence`. */
  status(status: AutosaveStatus): void;
  hide(): void;
  destroy(): void;
}
export declare function createPersistenceUi(options: PersistenceUiOptions): PersistenceUi;
