import { CLI_CATALOGS } from "./catalogs.js";
import { stats, type PresentationStats, type ReferenceFact, type StatsSlideRef, type SlideStats } from "@openpresentation/opf";
import type { CliContext } from "./context.js";

/** `opf stats <file|->`: neutral facts about a deck. Never validates, never composes, never needs fonts. */
export async function statsCommand(args: string[], cli: CliContext): Promise<void> {
  const { positional, options } = cli.parse(args, ["format", "per-slide"]);
  cli.arity(positional, 1);
  const format = String(options.format ?? "json");
  if (!["json", "text"].includes(format)) throw cli.fail("--format must be json or text.");
  const { value } = await cli.readJson(positional[0] as string);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw cli.fail("stats needs a presentation object.", 1);
  const result = stats(value, { perSlide: !!options["per-slide"], catalogs: CLI_CATALOGS });
  if (format === "json") cli.print(result);
  else process.stdout.write(formatStats(result));
}

const noun = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const ref = (fact: ReferenceFact | null) => (fact === null ? "none" : `${fact.id ?? "(unnamed)"}${fact.inline ? " (inline)" : ""}`);
const slideList = (slides: StatsSlideRef[], limit = 12) => {
  const names = slides.map((slide) => slide.id ?? `#${slide.index + 1}`);
  return names.length > limit ? `${names.slice(0, limit).join(", ")}, +${names.length - limit} more` : names.join(", ");
};
const counts = (record: Record<string, number>) => Object.entries(record).map(([key, count]) => `${key} ${count}`).join(", ") || "none";
const line = (label: string, value: string) => `${label.padEnd(15)}${value}\n`;

/** One readable block per topic. Same facts as the JSON, no more; nothing is rated. */
export function formatStats(result: PresentationStats): string {
  const { deck, slides, payloads, words, notes, images } = result;
  const size = deck.slideSize;
  let out = `${deck.name ?? "(unnamed presentation)"}\n`;
  out += line("Deck", `${size.preset ?? "custom"} ${size.widthInches} x ${size.heightInches} in (${size.aspectRatio}), language ${ref(deck.language)}, ${deck.template ? "template" : "not a template"}`);
  out += line("Design", `theme ${ref(deck.design.theme)}, colour scheme ${ref(deck.design.colorScheme)}, font scheme ${ref(deck.design.fontScheme)}`);
  out += line("Intent", `audience ${deck.audience.map(ref).join(", ") || "none"}; purpose ${ref(deck.purpose)}; tone ${ref(deck.tone)}; narrative ${deck.narrative ? `${ref(deck.narrative)}, ${noun(deck.narrative.beats, "beat")}` : "none"}`);
  out += line("People", `${noun(result.people.organizations.length, "organization")}${result.people.organizations.length ? ` (${result.people.organizations.map((entry) => entry.name || entry.id).join(", ")})` : ""}; ${noun(result.people.speakers.length, "speaker")}${result.people.speakers.length ? ` (${result.people.speakers.map((entry) => entry.name || entry.id).join(", ")})` : ""}`);
  out += line("Slides", `${slides.total}, ${slides.hidden.length} hidden${slides.hidden.length ? ` (${slideList(slides.hidden)})` : ""}; ${slides.withTitle} with a title`);
  out += line("Sections", slides.sections.length ? `${slides.sections.map((section) => `${section.name} ${section.slides}`).join(", ")}${slides.unsectioned ? `; ${slides.unsectioned} outside any section` : ""}` : "none");
  out += line("Layouts", `${counts(slides.layouts)}${slides.withoutLayout ? `; ${slides.withoutLayout} inferred` : ""}`);
  out += line("Payloads", `${counts(Object.fromEntries(Object.entries(payloads).filter(([key, count]) => key !== "maxDepth" && count > 0)))}; block depth ${payloads.maxDepth}`);
  out += line("Words", `${words.content} in content, ${words.notes} in notes (${words.total} total); per slide ${words.perSlide.min} to ${words.perSlide.max}, mean ${words.perSlide.mean}`);
  out += line("Notes", `${notes.withNotes} of ${slides.total} slides have notes${notes.withoutNotes.length ? `; none on ${slideList(notes.withoutNotes)}` : ""}`);
  out += line("Speaking time", `${result.speakingTime.minutes} min from the notes (${result.speakingTime.basis} at ${result.speakingTime.wordsPerMinute} wpm); declared ${result.speakingTime.declaredMinutes === null ? "none" : `${result.speakingTime.declaredMinutes} min`}`);
  out += line("Images", `${images.content.total} (${images.content.withAlt} with alt, ${images.content.decorative} decorative, ${images.content.missingAlt} missing alt); ${noun(images.logos, "logo")}; watermark ${images.watermarks.deck ? "deck" : "no"}${images.watermarks.slides ? ` +${images.watermarks.slides} slides` : ""}; image backgrounds ${images.backgrounds.deck ? "deck" : "no"}${images.backgrounds.slides ? ` +${images.backgrounds.slides} slides` : ""}; ${noun(images.videos, "video")}`);
  out += line("Charts", `${result.charts.total} (${counts(result.charts.byType)}); data inline ${result.charts.data.inline}, dataset ${result.charts.data.dataset}, source ${result.charts.data.source}`);
  out += line("Tables", `${result.tables.total}${result.tables.items.length ? ` (${result.tables.items.map((item) => `slide ${item.slide + 1}: ${item.rows}x${item.columns}`).join(", ")})` : ""}`);
  out += line("Datasets", `${result.datasets.count}, ${result.datasets.withSource} with a source`);
  out += line("Citations", `${noun(result.citations.references, "reference")} (${result.citations.cited.length} cited), ${noun(result.citations.citations, "citation")}, ${noun(result.citations.footnotes, "footnote")}, ${noun(result.citations.captions, "caption")}, ${noun(result.citations.links, "link")}`);
  out += line("Variables", `${result.variables.declared} declared (${counts(result.variables.byKind)}); ${result.variables.filled} filled, ${result.variables.unfilled.length} unfilled${result.variables.unfilledRequired.length ? ` (required: ${result.variables.unfilledRequired.join(", ")})` : ""}`);
  out += line("Assets", `${result.assets.registry.entries} in the registry; ${result.assets.uses.total} uses: ${result.assets.uses.references} references, ${result.assets.uses.embedded} embedded, ${result.assets.uses.files} files, ${result.assets.uses.remote} remote; ${result.assets.embeddedBytes} embedded bytes`);
  const furniture = (label: string, fact: PresentationStats["headerFooter"]["header"]) => (fact.suppressed ? `${label} off` : fact.configured ? `${label} ${fact.zones.join("+")} (${fact.fields.join(", ")})` : `${label} none`);
  const overrides = result.headerFooter.slides;
  out += line("Header/footer", `${furniture("header", result.headerFooter.header)}; ${furniture("footer", result.headerFooter.footer)}; slide overrides: header ${overrides.headerOverrides} (${overrides.headerSuppressed} off), footer ${overrides.footerOverrides} (${overrides.footerSuppressed} off)`);
  out += line("Fonts", `${result.fonts.families.join(", ") || "none"}${result.fonts.unresolvedSchemeIds.length ? `; unresolved schemes: ${result.fonts.unresolvedSchemeIds.join(", ")}` : ""}`);
  out += line("Colour vars", result.colors.variables.map((variable) => `${variable.id} ${variable.value ?? "(no value)"}`).join(", ") || "none");
  if (result.perSlide) {
    out += "\nPer slide\n";
    for (const slide of result.perSlide) out += `  ${String(slide.index + 1).padStart(3)}  ${slideLine(slide)}\n`;
  }
  return out;
}

function slideLine(slide: SlideStats): string {
  const parts = [slide.id ?? "-", slide.layout ?? "(inferred layout)", slide.title ? JSON.stringify(slide.title) : "(no title)"];
  const facts = [`${slide.words.content} words`, slide.hasNotes ? `${slide.words.notes} note words` : "no notes", ...(slide.payloads.length ? [slide.payloads.join("+")] : [])];
  if (slide.hidden) facts.push("hidden");
  if (slide.section) facts.push(`section ${slide.section}`);
  return `${parts.join("  ")}  [${facts.join(", ")}]`;
}
