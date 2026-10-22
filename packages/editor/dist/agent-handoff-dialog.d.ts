import type { AgentHandoff, AgentHandoffTarget } from "./agent-handoff.js";

export interface AgentHandoffDialogOptions {
  /** The OPF document the prompt embeds, unchanged, as JSON. */
  document: unknown;
  /** The selected target. Default `"pptx"`. */
  target?: AgentHandoffTarget;
  /** The name the agent saves the deck as (default `deck.opf.json`). */
  fileName?: string;
  specUrl?: string;
  agentGuideUrl?: string;
  /** `"touch"` makes the controls 40px. Default `"comfortable"` (32px). */
  density?: "comfortable" | "touch";
  /** Called once after the dialog closes (Close, X, Escape or a click on the scrim) and focus has been returned. Not called by `destroy()`. */
  onClose?: () => void;
  /** The author switched the target. */
  onTargetChange?: (target: AgentHandoffTarget) => void;
  /** "Download .md". Default: save `deck-handoff.md` through a Blob link. */
  onDownload?: (download: { blob: Blob; fileName: string; format: "handoff" }) => void;
  /** The element that gets focus back on close. Default: the element focused when the dialog opened. */
  returnFocus?: HTMLElement | null;
}

export interface AgentHandoffDialog {
  /** The overlay (scrim and dialog), already mounted in the container. */
  element: HTMLElement;
  /** The prompt now shown: `{ markdown, lines }`. */
  getPrompt(): AgentHandoff;
  setTarget(target: AgentHandoffTarget): void;
  /** Replace the deck the prompt embeds. */
  setDocument(document: unknown): void;
  /** Copy the prompt; resolves false when the browser refused (the text is then selected). */
  copy(): Promise<boolean>;
  /** Close the dialog, return focus and call `onClose`. */
  close(): void;
  /** Remove the dialog without returning focus or calling `onClose`. */
  destroy(): void;
}

/**
 * A modal dialog (`role="dialog"`, `aria-modal`) over the prompt `buildAgentHandoff` writes: a target switch, the read-only prompt in mono
 * with its line count, Copy prompt (shows "Copied" for 1.2 s) and Close. Focus is trapped inside, Escape closes, and focus returns to the
 * opener. CSS: `src/styles/handoff.css`, classes `opf-handoff-*`.
 */
export declare function createAgentHandoffDialog(container: HTMLElement, options: AgentHandoffDialogOptions): AgentHandoffDialog;
