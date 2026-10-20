/** The render targets of the handoff prompt. */
export type AgentHandoffTarget = "pptx" | "pdf" | "svg";

export interface AgentHandoffOptions {
  /** What the agent renders to. Default `"pptx"`. */
  target?: AgentHandoffTarget;
  /** The name the agent saves the deck as, and the base name of the output file. Default `"deck.opf.json"`. */
  fileName?: string;
  /** The Spec link. Default `"https://openpresentation.org/spec"`. */
  specUrl?: string;
  /** The Agent guide link. Default `"https://openpresentation.org/agents"`. */
  agentGuideUrl?: string;
}

export interface AgentHandoff {
  /** The prompt: `# Task`, `## Setup`, `## Steps`, the Spec and Agent guide links, then the deck in a fenced JSON block. */
  markdown: string;
  /** The number of lines in `markdown`. */
  lines: number;
}

export declare const DEFAULT_SPEC_URL: "https://openpresentation.org/spec";
export declare const DEFAULT_AGENT_GUIDE_URL: "https://openpresentation.org/agents";
export declare const DEFAULT_HANDOFF_FILE_NAME: "deck.opf.json";
/** Each target's label (as the prompt and the dialog say it), output extension and the npm packages the agent installs. */
export declare const HANDOFF_TARGETS: Readonly<Record<AgentHandoffTarget, { readonly label: string; readonly extension: string; readonly packages: readonly string[] }>>;

/**
 * The handoff prompt for a coding agent: install the published CLI (`@openpresentation/cli`, with the renderer and, for PowerPoint, the PPTX converter), save the deck, validate it with `npx opf validate`, render it with `npx opf convert`, report the
 * output path and warnings. Pure: no DOM or network. The deck is embedded as `JSON.stringify(document, null, 2)`, unchanged, in a fence
 * longer than any run of backticks in it. Throws `RangeError` for an unknown target and `TypeError` for a document that is not JSON.
 */
export declare function buildAgentHandoff(document: unknown, options?: AgentHandoffOptions): AgentHandoff;
