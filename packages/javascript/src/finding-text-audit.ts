/**
 * The plain-words text of the accessibility, layout and content rules (VALIDATOR-HINTS section 8, "Accessibility, layout and content"). Internal
 * module; `finding-text-rules.ts` assembles it with the format, references and policy rules.
 *
 * These rules carry their numbers in `measured`, their quick fixes in `fixes`, the slide in `slide`, and the rest in core's own sentence. A handler
 * prefers the structured data and reads the sentence with an anchored expression only for what has no other home; when the sentence is not the
 * expected shape it returns core's message kept (American spelling), never a guess.
 */
import type { Finding } from "./generated/types/finding.js";
import { type RuleText, cap, code, isRecord, } from "./finding-text-util.js";
import {
  blockKind,
  brief,
  chooseNext,
  isText,
  keep,
  lastName,
  match,
  onSlide,
  andList,
  sentence,
  slideNumber,
  slideRef,
  unquote,
  us,
} from "./finding-text-helpers.js";

const measuredNumber = (finding: Finding, key: string): number | undefined => {
  const value = finding.measured?.[key];
  return typeof value === "number" ? value : undefined;
};
const measuredText = (finding: Finding, key: string): string | undefined => {
  const value = finding.measured?.[key];
  return typeof value === "string" ? value : undefined;
};
/** A number without a trailing `.0` and at most two decimals. */
const num = (value: number, digits = 2): string => String(Math.round(value * 10 ** digits) / 10 ** digits);

// ------------------------------------------------------------------------------------------------ accessibility

const textContrast: RuleText = (finding) => {
  const ratio = measuredNumber(finding, "ratio");
  const needed = measuredNumber(finding, "needed");
  const foreground = measuredText(finding, "textColor");
  const background = measuredText(finding, "backgroundColor");
  if (ratio === undefined || needed === undefined) return undefined;
  const label = match(finding.message, /^(.+?) colou?r /)?.[1];
  const subject = label && !/^(Text|Colou?red text)$/.test(label) ? us(label) : "Text";
  const colors = foreground && background ? ` ${code(foreground)} on ${code(background)}` : "";
  const large = finding.measured?.large === true ? " for large text" : finding.measured?.large === false ? " for normal-size text" : "";
  const also = measuredNumber(finding, "alsoAffected");
  const fix = finding.fixes?.find((entry) => entry.id === "use-readable-color");
  const replacement = fix?.kind === "patch" && fix.patch?.[0] && "value" in fix.patch[0] ? fix.patch[0].value : undefined;
  const overrides = finding.path.endsWith("/color");
  return {
    message: `${subject}${colors} has contrast ${num(ratio)}:1; WCAG needs ${num(needed)}:1${large}.${also ? ` ${also} more text element${also === 1 ? "" : "s"} on this slide ${also === 1 ? "has" : "have"} the same problem.` : ""}`,
    next:
      typeof replacement === "string"
        ? replacement === "text"
          ? `use ${code("text")}, the slide's text color, which is readable here.`
          : `use ${code(replacement)}, which is readable here.`
        : overrides
          ? "pick a color with more contrast against the background, or remove the override so the theme chooses a readable one."
          : "change the slide background or the color scheme, or give the text an explicit readable color.",
  };
};

const textOnImage: RuleText = (finding) => {
  const ratio = measuredNumber(finding, "ratio");
  const needed = measuredNumber(finding, "needed");
  return {
    message: `Contrast over this picture can't be measured${ratio !== undefined && needed !== undefined ? `: against the lightest or darkest possible pixels it is as low as ${num(ratio, 1)}:1, and ${num(needed)}:1 is needed` : ""}.`,
    next: `add a full-frame ${code("overlay")} to the background image, so the text stays readable on any picture.`,
  };
};

const ALT_SUBJECT: Record<string, string> = {
  Image: "This image",
  Video: "This video",
  "Header/footer image": "This header or footer image",
  "Speaker photo": "This speaker photo",
  "Quote photo": "This quote photo",
  "Organization logo": "This organization logo",
  Picture: "This picture",
};

const missingAltText: RuleText = (finding) => {
  const found = match(finding.message, /^(.+?) has (no|blank) alt text\.$/);
  if (!found) return undefined;
  const subject = ALT_SUBJECT[found[1] as string] ?? `This ${(found[1] as string).toLowerCase()}`;
  return {
    message: `${subject} has ${found[2] === "blank" ? "blank" : "no"} alt text.`,
    next: `describe it in ${code("alt")}, or write ${code('alt: ""')} if it is only decoration.`,
  };
};

const poorAltText: RuleText = (finding) => {
  const found = match(finding.message, /^(?:(Chart) |(.+?) )?alt text ("(?:[^"\\]|\\.)*") (.+)\.$/);
  if (!found) return undefined;
  const alt = unquote(found[3]);
  const chart = found[1] === "Chart";
  const problem = (found[4] as string).replace(/^is a generic word, not what the data shows$/, "is a generic word");
  return {
    message: `Alt text ${code(brief(alt, 50))} ${us(problem)}, so it doesn't describe the ${chart ? "chart" : "picture"}.`,
    next: chart
      ? "state what the chart shows: its point and the key numbers, in a sentence or two."
      : `describe what the picture shows, in plain words and without a leading "image of".`,
  };
};

const missingSlideTitle: RuleText = (finding, _context, helpers) => ({
  message: `${slideRef(finding, helpers)} has no title, and screen reader users find slides by title.`,
  next: `write a ${code("title")} for it.`,
});

const duplicateSlideTitle: RuleText = (finding) => {
  const found = match(finding.message, /^Slide (\d+) has the same title as slide (\d+): ("(?:[^"\\]|\\.)*")\.$/);
  if (!found) return undefined;
  return {
    message: `Slides ${found[2]} and ${found[1]} share the title ${code(unquote(found[3]))}.`,
    next: "give one of them a title that tells it apart, so people can find each slide by title.",
  };
};

const readingOrder: RuleText = (finding) => {
  const above = match(finding.message, /^Content ("(?:[^"\\]|\\.)*") is drawn above the title but is read after it\.$/);
  if (above) {
    return {
      message: `${code(unquote(above[1]))} is drawn above the title but is read after it${onSlide(finding)}.`,
      next: "move the title above the content, or choose a layout that puts the title first.",
    };
  }
  const found = match(finding.message, /^Reading order differs from visual order: ("(?:[^"\\]|\\.)*") is read at (\w+) but appears at (\w+)\./);
  if (!found) return undefined;
  return {
    message: `${code(unquote(found[1]))} is read ${found[2]} but appears ${found[3]}${onSlide(finding)}, so a screen reader reads the slide out of order.`,
    next: "reorder the blocks so the reading order follows what people see, or pin them to layout regions.",
  };
};

const linkText: RuleText = (finding) => {
  const found = match(finding.message, /^Link text ("(?:[^"\\]|\\.)*") (is blank|is generic|is a long raw URL); the destination is (.+)\.$/);
  if (!found) return undefined;
  const text = unquote(found[1]);
  const destination = found[3] as string;
  const message =
    found[2] === "is blank"
      ? "The link text is blank, so a screen reader announces only that there is a link."
      : found[2] === "is generic"
        ? `The link text ${code(brief(text, 40))} doesn't say where it goes.`
        : "The link text is a long raw web address, which a screen reader reads out character by character.";
  return { message, next: `say what is at ${destination}, for example the page or file name.` };
};

const chartColorOnly: RuleText = (finding) => {
  const parts = match(finding.message, /^(Series|Slices) may be hard to tell apart without colou?r/);
  const noun = parts?.[1] === "Slices" ? "slices" : "series";
  const pairs = measuredNumber(finding, "confusablePairs");
  const repeat = match(finding.message, /(\d+) (?:series|slices) exceed the (\d+)-colou?r palette/);
  const count = measuredNumber(finding, "series");
  const message =
    pairs !== undefined
      ? `Some ${noun} differ by color only: ${pairs === 1 ? "one pair looks" : `${pairs} pairs look`} alike to color-blind viewers or in grayscale.${repeat ? ` ${repeat[1]} ${noun} exceed the ${repeat[2]}-color palette, so colors repeat.` : ""}`
      : `${cap(noun)} differ by color only${count !== undefined ? ` (${count} ${noun})` : ""}.`;
  return { message, next: `add data labels or a direct legend, choose more distinct ${code("colors")}, or show fewer ${noun}.` };
};

const chartColorsAdjusted: RuleText = (finding, _context, helpers) => {
  const index = match(finding.message, /^Chart colou?r (\d+) /)?.[1] ?? (isText(helpers.segments.at(-1)) ? String(Number(helpers.segments.at(-1)) + 1) : undefined);
  const value = helpers.valueAt(helpers.segments);
  const shown = typeof value === "string" ? value : unquote(match(finding.message, /^Chart colou?r \d+ \((.+?)\) /)?.[1]);
  const contrast = measuredNumber(finding, "contrast");
  const panel = measuredText(finding, "panel");
  const label = index ? `Chart color ${index}` : "A chart color";
  if (/cannot be resolved/.test(finding.message)) {
    return {
      message: `${label} (${code(shown)}) can't be resolved, so the palette color of that position is used.`,
      next: `write a hex color like ${code("#1F4E79")}, a scheme color such as ${code("accent1")}, or a ${code("var:")} reference to a declared variable.`,
    };
  }
  if (contrast === undefined) return undefined;
  return {
    message: `${label} (${code(shown)}) has ${num(contrast, 1)}:1 contrast against the chart panel${panel ? ` (${code(panel)})` : ""}, so it is drawn lighter or darker to reach 3:1.`,
    next: `pick a color with at least 3:1 contrast against ${panel ? code(panel) : "the panel"}, or remove ${code("colors")} to use the palette.`,
  };
};

const chartTextAlternative: RuleText = (finding) => {
  const where = match(finding.message, /^The (.+?) (?:has no alt text|is marked decorative)/)?.[1] ?? "chart";
  if (/is marked decorative/.test(finding.message)) {
    return {
      message: `The ${where} is marked decorative (empty ${code("alt")}), so assistive technology skips it.`,
      next: `write a sentence in ${code("alt")} if the chart carries information that people need.`,
    };
  }
  return {
    message: `The ${where} has no text alternative.`,
    next: `write the message it carries in ${code("alt")}, or add text beside it that states what it shows.`,
  };
};

const missingLanguage: RuleText = (_finding, context, helpers) => ({
  message: "The deck doesn't declare its language.",
  next:
    (context.format ?? helpers.format) === "json"
      ? `add ${code('"language": "en-US"')} (or the language the text is written in) to the deck.`
      : `add ${code("language: en-US")} (or the language the text is written in) to the deck.`,
});

// ------------------------------------------------------------------------------------------------ layout

const chartOptionAdapted: RuleText = (finding, _context, helpers) => {
  const at = helpers.segments.indexOf("chart");
  const option = at >= 0 ? helpers.segments.slice(at + 1).join(".") : (lastName(helpers.segments) ?? "");
  if (!option) return undefined;
  const type = at >= 0 ? helpers.valueAt([...helpers.segments.slice(0, at + 1), "type"]) : undefined;
  const typeName = typeof type === "string" ? type : match(finding.message, /^A '(.+?)' chart/)?.[1];
  const adaptation = finding.message.includes(";") ? cap(us(finding.message.slice(finding.message.indexOf(";") + 1).trim())) : "";
  return {
    message: `${code(option)} isn't supported by ${typeName ? `a ${typeName}` : "this"} chart and is adapted.${adaptation ? ` ${sentence(adaptation)}` : ""}`,
    next: `remove ${code(option)}, or choose a chart type that can show it.`,
  };
};

const textOverflow: RuleText = (finding) => {
  const message = finding.message;
  let subject = `Text${onSlide(finding)} doesn't fit at the smallest allowed size.`;
  const footnote = match(message, /^Footnote (\d+) does not fit/);
  if (/^The caption does not fit/.test(message)) subject = `The caption${onSlide(finding)} doesn't fit its band at the smallest allowed size.`;
  else if (footnote) subject = `Footnote ${footnote[1]}${onSlide(finding)} doesn't fit the footnote area.`;
  return { message: subject, next: "shorten it, split the slide, or choose a roomier layout." };
};

const unresolvedContent: RuleText = (finding) => ({
  message: keep(finding.message),
  next: "supply what the message asks for, or remove the setting that can't be honored.",
});

const layoutFailed: RuleText = (finding, _context, helpers) => {
  const reason = match(finding.message, /^Layout failed: (.+)$/)?.[1];
  return {
    message: `${slideRef(finding, helpers)} couldn't be laid out${reason ? `: ${sentence(us(reason)).replace(/\.$/, "")}` : ""}, so the geometry checks were skipped.`,
    next: "fix the composition setting or content named above.",
  };
};

const minFontSize: RuleText = (finding) => {
  const size = measuredNumber(finding, "sizePt");
  const minimum = measuredNumber(finding, "minimumPt");
  if (size === undefined || minimum === undefined) return undefined;
  const run = /^Text run is set to/.test(finding.message);
  const label = run ? "A text run" : (match(finding.message, /^(.+?) is drawn at/)?.[1] ?? "Text");
  return {
    message: `${cap(us(label))}${onSlide(finding)} ${run ? "is set to" : "is drawn at"} ${num(size, 1)} pt, below the ${num(minimum, 1)} pt readable minimum.`,
    next: run ? `raise ${code("fontSize")} to at least ${num(minimum, 1)}.` : "shorten the text, give it more room or split the slide, so it can be drawn larger.",
  };
};

/** The body region names of the layout record a slide uses, when the deck embeds it. */
function regionNamesOf(slideLayout: unknown, helpers: { valueAt(path: readonly string[]): unknown }): { id: string; names: string[] } | undefined {
  if (typeof slideLayout !== "string" || !slideLayout) return undefined;
  const colon = slideLayout.indexOf(":");
  const group = colon > 0 ? slideLayout.slice(0, colon) : undefined;
  const id = colon > 0 ? slideLayout.slice(colon + 1) : slideLayout;
  const record = (group ? [group] : ["custom", "default"]).map((name) => helpers.valueAt(["catalogs", name, "layouts", id])).find(isRecord);
  if (!record) return undefined;
  const names: string[] = [];
  const walk = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if (!isRecord(entry)) continue;
      if (typeof entry.name === "string" && !["title", "subtitle", "tag"].includes(entry.name)) names.push(entry.name);
      walk(entry.regions);
    }
  };
  walk(record.regions);
  return { id: slideLayout, names };
}

const regionUnknown: RuleText = (finding, _context, helpers) => {
  const region = match(finding.message, /^The layout has no region '(.+?)'/)?.[1];
  if (!region) return undefined;
  const slide = slideNumber(finding);
  const layout = slide ? regionNamesOf(helpers.valueAt(["slides", String(slide - 1), "layout"]), helpers) : undefined;
  const known = layout?.names ?? [];
  return {
    message: layout
      ? `Block pinned to region ${code(region)}; layout ${code(layout.id)} has ${andList(known)}.`
      : `A block is pinned to region ${code(region)}, which the slide's layout doesn't have.`,
    next: known.length ? chooseNext(region, known, `remove ${code("region")}`) : `pin it to a region the layout has, or remove ${code("region")}.`,
  };
};

const regionKind: RuleText = (finding) => {
  const found = match(finding.message, /^Region '(.+?)' does not accept (\S+) content \(it accepts (.+?)\)/);
  if (!found) return undefined;
  return {
    message: `Region ${code(found[1])} doesn't take ${found[2]} content (it takes ${found[3]}).`,
    next: `remove ${code("region")} so OPF places the block by its kind, or pin it to a region that takes ${found[2]}.`,
  };
};

const regionFull: RuleText = (finding) => {
  const found = match(finding.message, /^Region '(.+?)' already holds its (\d+) block/);
  if (!found) return undefined;
  return {
    message: `Region ${code(found[1])} already holds ${found[2]} block${found[2] === "1" ? "" : "s"}, which is all it takes.`,
    next: `pin the block to another region with room, or remove ${code("region")}.`,
  };
};

const layoutUnplaced: RuleText = (finding, _context, helpers) => {
  const kind = blockKind(helpers.valueAt(helpers.segments));
  const what = kind ? `this ${kind} block` : "this block";
  const overflow = match(finding.message, /drawn in '(.+?)' beyond its (\d+) block/);
  return {
    message: overflow
      ? `No region has room for ${what}; it is drawn in ${code(overflow[1])}, beyond its ${overflow[2]} block${overflow[2] === "1" ? "" : "s"}.`
      : `No region has room for ${what}; it is drawn in the overflow area.`,
    next: "paginate the slide, choose a layout with more room, or remove a block.",
  };
};

const furnitureWraps: RuleText = (finding) => {
  const found = match(finding.message, /^The (.+?) text wraps onto (\d+) lines? \(at most (\d+)\)/);
  const lines = measuredNumber(finding, "lines") ?? (found ? Number(found[2]) : undefined);
  const most = measuredNumber(finding, "maximumLines") ?? (found ? Number(found[3]) : undefined);
  const zone = found?.[1] ?? "header or footer";
  if (lines === undefined) return undefined;
  return {
    message: `The ${zone} text wraps onto ${lines} lines${most !== undefined ? ` (${most} at most)` : ""}; headers and footers should be short.`,
    next: "shorten it, or move part of it to another zone.",
  };
};

const fontOutsideScheme: RuleText = (finding) => {
  const found = match(finding.message, /^Text uses ("(?:[^"\\]|\\.)*"), which is not in the font scheme \((.+)\)\.$/);
  if (!found) return undefined;
  return {
    message: `${code(unquote(found[1]))} isn't in this deck's font scheme (${found[2]}), so it won't follow a scheme change.`,
    next: `remove ${code("fontFamily")} to use the scheme font, or add the font to the font scheme.`,
  };
};

const imageResolution: RuleText = (finding) => {
  const width = measuredNumber(finding, "widthPx");
  const height = measuredNumber(finding, "heightPx");
  const ppi = measuredNumber(finding, "ppi");
  const minimum = measuredNumber(finding, "minimumPpi");
  if (width === undefined || height === undefined || ppi === undefined) return undefined;
  const shown = match(finding.message, /shown ([\d.]+) x ([\d.]+) in/);
  const needed = shown && minimum !== undefined ? ` about ${Math.ceil(Number(shown[1]) * minimum)}×${Math.ceil(Number(shown[2]) * minimum)} px` : "";
  return {
    message: `This image is ${width}×${height} px, shown at about ${ppi} ppi${minimum !== undefined ? `; ${minimum} are needed to look sharp` : ""}.`,
    next: needed ? `use a file of${needed} or larger, or show it smaller.` : "use a larger file, or show the image smaller.",
  };
};

// ------------------------------------------------------------------------------------------------ content

const chartValueNotNumeric: RuleText = (finding) => {
  const value = unquote(match(finding.message, /^chart value ("(?:[^"\\]|\\.)*") is not a number/)?.[1]);
  const fix = finding.fixes?.find((entry) => entry.id === "store-chart-numbers");
  if (!value) return undefined;
  return {
    message: `${code(value)} is text, so it is plotted as a gap.`,
    next: fix ? `${sentence((fix.title.charAt(0).toLowerCase() + fix.title.slice(1)).replace(/\.$/, ""))}` : `write a number (12, -3.5, 1e6) and put units, currency or percent in the column ${code("format")}.`,
  };
};

const chartMappingAdapted: RuleText = (finding) => ({
  message: keep(cap(finding.message)),
  next: "remove that mapping entry, or name a different column.",
});

const chartHighlightAdapted: RuleText = (finding) => {
  const name = unquote(match(finding.message, /^highlight names \w+ ("(?:[^"\\]|\\.)*"), which is not plotted as a series/)?.[1]);
  if (!name) return undefined;
  return {
    message: `${code(name)} is not plotted as a series, so highlighting it changes nothing. It is the category or X column, or the mapping leaves it out.`,
    next: "name a series the chart plots, or remove the entry.",
  };
};

const codeHighlightOutOfRange: RuleText = (finding) => {
  const found = match(finding.message, /line (\d+) is past the last line \(the code has (\d+) lines?\)/);
  if (!found) return undefined;
  return {
    message: `Highlight line ${found[1]} is past the last line (${found[2]}), so it marks nothing.`,
    next: `change it to a line from 1 to ${found[2]}, or remove the entry.`,
  };
};

const codeHighlightRangeReversed: RuleText = (finding) => {
  const found = match(finding.message, /^The highlight range \[(\d+), (\d+)\] ends before it starts.*write \[(\d+), (\d+)\]/);
  if (!found) return undefined;
  return {
    message: `Highlight ${found[1]}–${found[2]} ends before it starts, so it marks no line.`,
    next: `write [${found[3]}, ${found[4]}].`,
  };
};

const variableBuiltinMissing: RuleText = (finding, _context, helpers) => {
  const idParam = isRecord(finding.validation?.params) ? finding.validation.params.id : undefined;
  const id = (typeof idParam === "string" ? idParam : undefined) ?? match(finding.message, /^Built-in '(.+?)' has no value/)?.[1] ?? match(finding.message, /'\{\{(.+?)\}\}'/)?.[1];
  if (!id) return undefined;
  const root = id.split(".")[0];
  const field = id.split(".").at(-1) ?? id;
  const token = code(`{{${id}}}`);
  void helpers;
  if (id === "slide.section") return { message: `${token} has no value: ${slideRef(finding, helpers)} has no section.`, next: `give the slide a ${code("section")}, or remove the token.` };
  if (root === "deck") return { message: `${token} has no value in this document.`, next: `add ${code(field)} to the deck.` };
  if (id === "speakers") return { message: `${token} has no value in this document.`, next: `add a ${code("speaker")} with a ${code("name")}.` };
  if (root === "speaker" || root === "organization") return { message: `${token} has no value in this document.`, next: `add ${code(field)} to ${code(root)}.` };
  return { message: `${token} has no value in this document.`, next: "add the field it reads." };
};

const durationOutsideNarrative: RuleText = (finding) => {
  const found = match(finding.message, /^The target duration of (\d+(?:\.\d+)?) minutes is outside the (.+?) narrative ("(?:[^"\\]|\\.)*") suits\.$/);
  if (!found) return undefined;
  return {
    message: `A ${found[1]}-minute deck is outside the ${found[2]} minutes that narrative ${code(unquote(found[3]))} suits.`.replace("minutes minutes", "minutes"),
    next: `change ${code("duration")}, or choose a narrative that suits ${found[1]} minutes.`,
  };
};

const narrativeDurationRange: RuleText = (_finding, _context, helpers) => {
  const range = helpers.valueAt(helpers.segments);
  if (isRecord(range) && typeof range.min === "number" && typeof range.max === "number") {
    return {
      message: `The duration range has min ${range.min} greater than max ${range.max}.`,
      next: `swap them: ${code(`min: ${range.max}`)} and ${code(`max: ${range.min}`)}.`,
    };
  }
  return { message: "The duration range has min greater than max.", next: `swap ${code("min")} and ${code("max")}.` };
};

const placeholderText: RuleText = (finding) => {
  const found = match(finding.message, /^Text looks like (.+?): ("(?:[^"\\]|\\.)*")\.$/);
  if (!found) return undefined;
  return {
    message: `${code(brief(unquote(found[2]), 50))} looks like placeholder text (${found[1]}).`,
    next: "replace it with the real text.",
  };
};

const emptyText: RuleText = (finding) => {
  const what = match(finding.message, /^The (.+) is empty\.$/)?.[1];
  if (!what) return undefined;
  return {
    message: `The ${what}${onSlide(finding)} is empty.`,
    next: `write the text, or remove the empty ${what}.`,
  };
};

const unusedBeat: RuleText = (finding, _context, helpers) => {
  const beat = measuredText(finding, "beat");
  const position = measuredNumber(finding, "position");
  const beats = measuredNumber(finding, "beats");
  if (!beat) return undefined;
  const narrative = isText(helpers.valueAt(["narrative"])) ? String(helpers.valueAt(["narrative"])) : unquote(match(finding.message, /of narrative ("(?:[^"\\]|\\.)*")/)?.[1]);
  return {
    message: `Beat ${code(beat)}${position !== undefined && beats !== undefined ? ` (${position} of ${beats})` : ""} of narrative ${code(narrative)} has no slide.`,
    next: `give a slide ${code(`beat: "${beat}"`)}, or ignore this if the beat is optional.`,
  };
};

const emptySlide: RuleText = (finding, _context, helpers) => ({
  message: `${slideRef(finding, helpers)} has no content.`,
  next: `add content or a ${code("title")}, remove the slide, or give it the ${code("blank")} layout if it is meant to be empty.`,
});

const languageTag: RuleText = (finding, _context, helpers) => {
  const value = helpers.valueAt(helpers.segments);
  const tag = typeof value === "string" ? value : match(finding.message, /^'(.+?)'/)?.[1];
  if (!tag) return undefined;
  const fix = finding.fixes?.find((entry) => entry.id === "use-canonical-tag");
  const replacement = fix?.kind === "patch" && fix.patch?.[0] && "value" in fix.patch[0] && typeof fix.patch[0].value === "string" ? fix.patch[0].value : match(finding.help ?? "", /^Write '(.+?)'\.$/)?.[1];
  const region = match(finding.message, /names the region '(.+?)', which is not an assigned region/)?.[1];
  const reason = /not a well-formed/.test(finding.message)
    ? "is not a well-formed language tag"
    : region
      ? `is not a valid tag: ${code(region)} is not an assigned region`
      : /not in canonical case/.test(finding.message)
        ? "is not in canonical case"
        : /deprecated/.test(finding.message)
          ? "uses a deprecated region"
          : "is not a valid language tag";
  return {
    message: `${code(tag)} ${reason}.`,
    next: replacement ? `did you mean ${code(replacement)}?` : `write a tag like ${code("en-US")}, ${code("pt-BR")} or ${code("es-419")}.`,
  };
};

export const AUDIT_TEXT: Readonly<Record<string, RuleText>> = {
  "opf/text-contrast": textContrast,
  "opf/text-on-image": textOnImage,
  "opf/missing-alt-text": missingAltText,
  "opf/poor-alt-text": poorAltText,
  "opf/missing-slide-title": missingSlideTitle,
  "opf/duplicate-slide-title": duplicateSlideTitle,
  "opf/reading-order": readingOrder,
  "opf/link-text": linkText,
  "opf/chart-color-only": chartColorOnly,
  "opf/chart-colors-adjusted": chartColorsAdjusted,
  "opf/chart-text-alternative": chartTextAlternative,
  "opf/missing-language": missingLanguage,
  "opf/chart-option-adapted": chartOptionAdapted,
  "opf/text-overflow": textOverflow,
  "opf/unresolved-content": unresolvedContent,
  "opf/layout-failed": layoutFailed,
  "opf/min-font-size": minFontSize,
  "opf/region-unknown": regionUnknown,
  "opf/region-kind": regionKind,
  "opf/region-full": regionFull,
  "opf/layout-unplaced": layoutUnplaced,
  "opf/furniture-wraps": furnitureWraps,
  "opf/font-outside-scheme": fontOutsideScheme,
  "opf/image-resolution": imageResolution,
  "opf/chart-value-not-numeric": chartValueNotNumeric,
  "opf/chart-mapping-adapted": chartMappingAdapted,
  "opf/chart-highlight-adapted": chartHighlightAdapted,
  "opf/code-highlight-out-of-range": codeHighlightOutOfRange,
  "opf/code-highlight-range-reversed": codeHighlightRangeReversed,
  "opf/variable-builtin-missing": variableBuiltinMissing,
  "opf/duration-outside-narrative": durationOutsideNarrative,
  "opf/narrative-duration-range": narrativeDurationRange,
  "opf/placeholder-text": placeholderText,
  "opf/empty-text": emptyText,
  "opf/unused-beat": unusedBeat,
  "opf/empty-slide": emptySlide,
  "opf/language-tag": languageTag,
};
