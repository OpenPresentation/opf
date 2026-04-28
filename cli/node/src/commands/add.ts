import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { CliError } from "../client.js";
import { info, printJson, success } from "../output.js";

/**
 * `pptx add <component>` scaffolds ready-to-edit OPF snippets. Runs
 * entirely offline — no API call. Keeps the snippets short and
 * schema-legal so `pptx validate` passes on the output.
 */
export function addCommand(): Command {
  return new Command("add")
    .description("Scaffold OPF component snippets (slide types, themes)")
    .argument("<component>", "Component to scaffold")
    .option("-o, --output <file>", "Write the snippet to this file instead of stdout")
    .addHelpText(
      "after",
      `\nAvailable components:\n${Object.keys(SNIPPETS)
        .sort()
        .map((k) => `  - ${k}`)
        .join("\n")}\n`,
    )
    .action((component: string, opts: { output?: string }) => {
      const snippet = SNIPPETS[component];
      if (!snippet) {
        throw new CliError(
          `Unknown component "${component}". Run \`pptx add --help\` to list available components.`,
          2,
        );
      }
      if (opts.output) {
        const path = resolve(opts.output);
        writeFileSync(path, `${JSON.stringify(snippet, null, 2)}\n`);
        success(`Wrote ${component} snippet → ${opts.output}`);
      } else {
        printJson(snippet);
        info(`component: ${component}`);
      }
    });
}

const SNIPPETS: Record<string, unknown> = {
  deck: {
    $schema: "https://pptx.dev/schema/opf/v1",
    meta: {
      title: "Untitled deck",
      author: "you@example.com",
      audience: "internal",
    },
    design: {
      theme: "default",
      colors: { primary: "#0f172a", accent: "#2563eb" },
      fonts: { heading: "Inter", body: "Inter" },
    },
    slides: [
      {
        layout: "title",
        headline: "Your headline here",
        subhead: "Your subhead",
      },
    ],
  },

  "slide.title": {
    layout: "title",
    headline: "Your headline",
    subhead: "Your subhead",
  },

  "slide.two-column": {
    layout: "two-column",
    headline: "Two column slide",
    columns: [
      { title: "Left", body: "Left column content" },
      { title: "Right", body: "Right column content" },
    ],
  },

  "slide.chart": {
    layout: "chart-with-callout",
    headline: "Chart headline",
    chart: {
      type: "bar",
      data: [
        { label: "A", value: 12 },
        { label: "B", value: 18 },
        { label: "C", value: 7 },
      ],
    },
    callout: "What the eye should land on",
  },

  "slide.quote": {
    layout: "quote",
    quote: "A quote that supports your point.",
    attribution: "Author, Role",
  },

  theme: {
    theme: "custom",
    colors: {
      primary: "#0f172a",
      accent: "#2563eb",
      background: "#ffffff",
      text: "#0f172a",
    },
    fonts: {
      heading: "Inter",
      body: "Inter",
    },
  },
};
