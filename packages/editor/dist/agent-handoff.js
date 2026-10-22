// RR-98: the agent handoff prompt. A pure function: an OPF document in, a Markdown prompt out, for a coding agent that installs the
// published CLI, validates the deck and renders it to PowerPoint, PDF or SVG. No DOM, no network, no clock. The commands it tells the agent
// to run are the published `opf` command (@openpresentation/cli 0.24, with the renderer 0.24.1 and PPTX 0.24.0 peers), run in a clean
// folder: `opf validate deck.opf.json` (exit 1 for an invalid deck, with the JSON path of each finding) and `opf convert deck.opf.json
// deck.pptx`. The renderer's `@expo-google-fonts/*` packages are optional peers that npm does not install, and the first conversion exits 2
// with `peer-not-installed` naming the exact (pinned) `npm install` command; the prompt says to run it rather than pin versions here that
// would go stale.

/** The default Spec link in the prompt. */
export const DEFAULT_SPEC_URL = "https://openpresentation.org/spec";
/** The default Agent guide link in the prompt. */
export const DEFAULT_AGENT_GUIDE_URL = "https://openpresentation.org/agents";
/** The file name the prompt tells the agent to save the deck as. */
export const DEFAULT_HANDOFF_FILE_NAME = "deck.opf.json";

/**
 * The render targets. `packages` are the npm packages the agent installs: PDF and SVG need the renderer, PowerPoint also needs the
 * PPTX converter. `extension` is the output file's extension.
 */
export const HANDOFF_TARGETS = Object.freeze({
  pptx: Object.freeze({ label: "PowerPoint (.pptx)", extension: "pptx", packages: Object.freeze(["@openpresentation/cli", "@openpresentation/opf-render", "@openpresentation/opf-pptx"]) }),
  pdf: Object.freeze({ label: "PDF", extension: "pdf", packages: Object.freeze(["@openpresentation/cli", "@openpresentation/opf-render"]) }),
  svg: Object.freeze({ label: "SVG slides", extension: "svg", packages: Object.freeze(["@openpresentation/cli", "@openpresentation/opf-render"]) }),
});

const VALIDATE = (file) => `npx opf validate ${file}`;
const CONVERT = (file, output) => `npx opf convert ${file} ${output}`;

/** The output file for a deck file: `deck.opf.json` gives `deck.pptx`; any other extension is replaced. */
function outputFor(fileName, extension) {
  const base = fileName.replace(/\.opf\.(json|ya?ml|md)$/i, "").replace(/\.[^./\\]+$/, "");
  return `${base || "deck"}.${extension}`;
}

/** A fence longer than any run of backticks in the text, so the deck's own strings can never close it. */
function fenceFor(text) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

/**
 * The handoff prompt for a coding agent.
 *
 * @param document The OPF document. It goes into the prompt as `JSON.stringify(document, null, 2)`, unchanged.
 * @param options `target` `"pptx"` (default), `"pdf"` or `"svg"`; `fileName` the name the agent saves the deck as (default
 *   `deck.opf.json`; the output file takes its base name); `specUrl` and `agentGuideUrl` (defaults: openpresentation.org).
 * @returns `{ markdown, lines }`: the prompt, and its line count.
 */
export function buildAgentHandoff(document, options = {}) {
  const { target = "pptx", fileName = DEFAULT_HANDOFF_FILE_NAME, specUrl = DEFAULT_SPEC_URL, agentGuideUrl = DEFAULT_AGENT_GUIDE_URL } = options;
  const spec = HANDOFF_TARGETS[target];
  if (!spec) throw new RangeError(`Unknown handoff target "${target}". Use one of: ${Object.keys(HANDOFF_TARGETS).join(", ")}.`);
  const json = JSON.stringify(document, null, 2);
  if (typeof json !== "string") throw new TypeError("buildAgentHandoff needs an OPF document that can be written as JSON.");
  const output = outputFor(fileName, spec.extension);
  const fence = fenceFor(json);
  const markdown = [
    "# Task",
    `Render this Open Presentation Format (OPF) deck to ${spec.label}.`,
    "",
    "## Setup",
    "Needs Node 22 or later. In an empty folder:",
    "",
    "```sh",
    `npm install ${spec.packages.join(" ")}`,
    "```",
    "",
    "The renderer draws with font packages that npm does not install for you. If a render stops with `peer-not-installed`, run the `npm install` command in its message, then run the step again.",
    "",
    "## Steps",
    `1. Save the JSON below as ${fileName}.`,
    "2. Validate it with the opf command. Fix any schema errors; keep the slide content unchanged. It exits 1 for an invalid deck and names the JSON path of each error; findings with severity warning or info are advisory.",
    "",
    "```sh",
    VALIDATE(fileName),
    "```",
    "",
    `3. Render ${fileName} to ${spec.label} with the same command line tool. It writes ${spec.extension === "svg" ? `one file per slide, named from ${output}` : output}; the JSON it prints lists the files and any findings.`,
    "",
    "```sh",
    CONVERT(fileName, output),
    "```",
    "",
    "4. Report the output file path and any advisory warnings.",
    "",
    `Spec: ${specUrl}`,
    `Agent guide: ${agentGuideUrl}`,
    "",
    `## ${fileName}`,
    `${fence}json`,
    json,
    fence,
  ].join("\n");
  return { markdown, lines: markdown.split("\n").length };
}
