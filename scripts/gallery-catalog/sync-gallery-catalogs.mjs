// FF-28: import pptx.gallery narrative and audience ids that the bundled catalogs lack.
//
//   node scripts/gallery-catalog/sync-gallery-catalogs.mjs [--gallery <dir>] [--check]
//
// Default mode writes a record for every gallery id missing from spec/catalogs/{narratives,audiences},
// inserts its index entry without reformatting the hand-written index files, adds the gallery's
// recommended narratives to existing audience records, and rewrites the resolved per-beat table in
// gallery-layout-map.json. Ids already in core are never overwritten.
// --check writes nothing: it re-derives every imported narrative's beats from the gallery data and
// the layout map, and fails when a committed record or the per-beat table disagrees.
//
// The gallery checkout defaults to a sibling of this repository (../pptx-gallery); it is not
// available in CI, so this script is a maintenance tool rather than a gate.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const galleryRoot = path.resolve(option("--gallery", path.join(repoRoot, "../pptx-gallery")));
const check = flag("--check");
const catalogDir = (kind) => path.join(repoRoot, "spec/catalogs", kind);
const mapPath = path.join(here, "gallery-layout-map.json");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
const q = (value) => JSON.stringify(value);
const inlineArray = (values) => `[${values.map(q).join(", ")}]`;

// Curated prose. The gallery's description repeats its summary, so these fold the gallery-only
// fields (bestFor, rhetoricalTone, example, slideCountRange, exampleDeckTypes) into description, and
// turn its human-readable audienceFit labels into kebab-case slugs.
const NARRATIVES = {
  "heros-journey": {
    after: "classic-story",
    audienceFit: ["general-public", "employees", "community"],
    description:
      "A storytelling framework that takes the audience on an emotional journey of change and growth. Show where things started, the obstacle that forced a change, the path taken and the obstacles overcome, the turning point, and the improved reality with the lessons it taught. The tone is narrative: it builds an emotional arc and invites the audience to identify with the protagonist, whether that is a customer, a team, or the company itself. Best for case studies, brand stories, and change management; typical decks run 5-10 slides (brand story, startup pitch, culture deck, change story).",
  },
  "what-so-what-now-what": {
    after: "situation-complication-resolution",
    audienceFit: ["executive", "senior-managers", "board"],
    description:
      "A concise framework that connects information to meaning to action. Present the facts or findings objectively, explain why they matter to this audience, then state the decisions or next steps they require. The tone is analytical: data-forward and respectful of executive time, with no scene-setting beyond what the facts need. Best for executive briefings, status updates, and research findings; typical decks run 3-6 slides (analytics report, team performance review, strategy update).",
  },
  "situation-complication-resolution": {
    after: "pyramid-principle",
    audienceFit: ["senior-leadership", "consultants", "strategy-teams"],
    description:
      "A McKinsey-style structure that builds tension before delivering the insight. Establish the context everyone already agrees on, introduce what has changed or what challenge has emerged, name the key question that change raises, then deliver the recommendation that resolves it. The tone is logical: a tight causal chain from context to recommendation. Best for strategy presentations, consulting decks, and analytical reports; typical decks run 4-10 slides (management consulting report, strategic recommendation, board update).",
  },
  "star-method": {
    after: "failure-analysis",
    audienceFit: ["hr-and-talent", "performance-reviewers", "award-committees"],
    description:
      "A results-focused framework that demonstrates impact through a concrete example: the Situation, the Task you were responsible for, the Actions you took, and the measurable Result. The tone is evidential: every claim is grounded in a specific, verifiable outcome. Best for project reviews, portfolio presentations, and achievement showcases; typical decks run 4-8 slides (case study, customer success story, project retrospective).",
  },
  "pyramid-principle": {
    after: "scqa",
    audienceFit: ["executive", "board", "time-pressed-decision-makers"],
    description:
      "Lead with the conclusion, then provide the supporting logic. State the main recommendation up front, follow with three or four arguments that support it, then back each argument with data and examples. The tone is deductive: conclusion first, reasoning second, so the audience never waits for the point. Best for executive presentations, recommendations, and time-constrained settings; typical decks run 3-8 slides (consulting recommendation, investment thesis, strategic options analysis).",
  },
  sparkline: {
    after: "persuasive-sales",
    audienceFit: ["prospective-buyers", "skeptical-stakeholders", "evaluation-committees"],
    description:
      "A tight comparison arc that shows the move from an inferior state to a superior one, anchored by contrast. Make the painful before state vivid, reveal the product, decision, or event that changes the trajectory, present the new reality in concrete terms, then prove it with data or testimonial. The tone is contrastive: it makes the gap between old and new viscerally clear. Best for product demos, case study summaries, ROI presentations, and before-and-after technology comparisons; typical decks run 4-6 slides.",
  },
  "data-story": {
    after: "trend-analysis",
    audienceFit: ["data-teams", "operations-and-finance", "product-managers", "analytics-stakeholders"],
    description:
      "A data-first narrative that builds from evidence to insight to action. Set the analytical context and the question the data answers, reveal the headline finding, walk through the supporting analysis and its sources, explain what it means for the business, then make a specific recommendation with its confidence level and assumptions. The tone is analytical and inductive: it builds up from data to insight. Best for analytical briefings, data team presentations, research readouts, and business reviews; typical decks run 6-15 slides.",
  },
  "change-story": {
    after: "business-narrative",
    audienceFit: ["employees", "team-leads", "cross-functional-teams"],
    description:
      "A change management narrative that addresses the emotional and rational objections people face when asked to change. Establish the burning platform, explain why the timing is urgent, show the chosen path and the alternatives it was chosen over, make the stakes concrete for the organization, the team, and individuals, and close on a shared vision in which the audience is the protagonist. The tone is motivational and empathetic: it acknowledges that change is hard while building conviction. Best for organizational change, transformation announcements, restructuring communications, and all-hands meetings; typical decks run 8-15 slides.",
  },
  "vision-roadmap": {
    after: "project-proposal",
    audienceFit: ["leadership-teams", "board", "product-and-strategy-teams", "all-hands"],
    description:
      "Connects a compelling long-term vision to near-term executable plans, bridging aspiration and action. Open with a specific three-to-five-year North Star, honestly diagnose the gap between today and that vision, organize the strategy into two to four named pillars, show the phased roadmap with milestones and dependencies, and end with concrete, assigned first steps for the next 30-90 days. The tone is inspirational and strategic: it creates shared direction and commitment to a plan. Best for strategic planning, annual kickoffs, product strategy, and OKR launches; typical decks run 8-20 slides.",
  },
};

// The gallery-only keyDesignPrinciples, slideCountGuidance and recommendedChartDensity fields,
// folded into the schema's description.
const AUDIENCE_DESCRIPTIONS = {
  executive:
    "C-suite and senior leaders deciding on strategy, ROI, and big-picture outcomes with very little time. Lead with the conclusion and keep to one insight per slide; set the key numbers in bold type and use as few bullet points as possible. Keep chart density low and the deck to 10-15 slides at most.",
  investor:
    "Angel, venture, and institutional investors judging financial viability, market opportunity, and the team. Lead with traction, size the market (TAM, SAM, SOM), make the moat and differentiation explicit, and show financial projections with their assumptions stated. Moderate chart density; 12-20 slides.",
  technical:
    "Engineers, data scientists, and technical specialists who expect precision, methodology, and system-level understanding. Show the methodology and cite data sources, prefer technical diagrams to metaphors, and do not shy away from dense information. Chart density can be high; 20-40 slides is normal.",
  sales:
    "Sales teams and prospective customers weighing product benefits, competitive differentiation, and ROI. Put customer success stories first, back claims with visual proof points, state the value proposition plainly, and close on a strong call to action. Moderate chart density; 15-25 slides.",
  marketing:
    "Marketing professionals reviewing campaign performance, brand metrics, and growth strategy. Make the funnel visible, highlight engagement metrics, keep the brand consistent, and tell the story visually. Moderate chart density; 15-30 slides.",
  academic:
    "Researchers, professors, and students who expect rigorous methodology, citations, and evidence-based conclusions. Cite every source, show confidence intervals, be transparent about method, and leave marketing language out. Chart density can be high; 20-50 slides with time reserved for questions.",
  "internal-team":
    "Employees across functions receiving operational updates, project status, or training. Make next steps, owners, and progress visible, and state action items explicitly. Moderate chart density; 10-20 slides.",
  customer:
    "Customers receiving product demos, onboarding, or business reviews. Speak in their language, focus on the value they realize, keep visuals simple, and use strong product screenshots. Keep chart density low; 10-20 slides.",
  "general-public":
    "A mixed audience of non-experts with no assumed domain knowledge. Prefer analogies to data, use only simple charts, set large text for accessibility, and structure the talk as a story. Keep chart density low; 10-15 slides.",
  media:
    "Journalists, analysts, and media professionals looking for newsworthy insight and quotable statistics. Make headline numbers prominent, attribute every figure clearly, design for print, and add embargo notes when needed. Moderate chart density; 8-12 slides in press-kit format.",
  partner:
    "Strategic partners, resellers, and channel organizations who need positioning and enablement content. Highlight partner economics, include co-branding guidelines, state the value proposition for their customers, and link enablement resources. Moderate chart density; 15-25 slides.",
  regulatory:
    "Government agencies, auditors, and compliance bodies reviewing adherence to rules and standards. Lead with evidence, date-stamp material, cite document references, and map each claim to the requirement it satisfies. Moderate chart density; 20-40 slides with an appendix.",
};

function mapBeat(layoutMap, beat) {
  const rule = layoutMap.layouts[beat.layoutHint];
  if (!rule) throw new Error(`gallery layout '${beat.layoutHint}' has no entry in gallery-layout-map.json`);
  const n = Number.parseInt(beat.options?.multiple ?? "1x", 10) || 1;
  const subtitle = beat.placeholders?.subtitle === true;
  const template = subtitle && rule.withSubtitle ? rule.withSubtitle : rule.layoutHint;
  return { slideType: rule.slideType, layoutHint: template.replace("{n}", String(n)) };
}

function narrativeRecord(layoutMap, gallery) {
  const prose = NARRATIVES[gallery.id];
  return {
    $schema: "https://openpresentation.org/schema/opf-narrative/v1",
    id: gallery.id,
    name: gallery.name,
    summary: gallery.summary,
    description: prose.description,
    audienceFit: prose.audienceFit,
    durationRange: gallery.durationRange,
    tags: gallery.tags,
    beats: gallery.beats.map((beat) => ({
      id: beat.id,
      name: beat.name,
      description: beat.description,
      instructions: beat.instructions,
      ...(beat.slideCount > 1 ? { slideCount: beat.slideCount } : {}),
      ...mapBeat(layoutMap, beat),
    })),
  };
}

function beatTable(layoutMap, galleryNarratives) {
  return galleryNarratives
    .filter((narrative) => NARRATIVES[narrative.id])
    .flatMap((narrative) =>
      narrative.beats.map((beat) => ({
        narrative: narrative.id,
        beat: beat.id,
        galleryLayout: beat.layoutHint,
        galleryMultiple: beat.options?.multiple ?? "1x",
        gallerySubtitle: beat.placeholders?.subtitle === true,
        gallerySlideType: beat.slideType,
        ...mapBeat(layoutMap, beat),
      })),
    );
}

function indexEntry(record) {
  return [
    "    {",
    `      "id": ${q(record.id)},`,
    `      "name": ${q(record.name)},`,
    `      "summary": ${q(record.summary)},`,
    `      "audienceFit": ${inlineArray(record.audienceFit)},`,
    `      "durationRange": { "minMinutes": ${record.durationRange.minMinutes}, "maxMinutes": ${record.durationRange.maxMinutes} },`,
    `      "tags": ${inlineArray(record.tags)},`,
    `      "file": ${q(`${record.id}.json`)}`,
    "    },",
  ].join("\n");
}

const layoutMap = await readJson(mapPath);
const galleryNarratives = (await readJson(path.join(galleryRoot, "data/narratives.json"))).items;
const galleryAudiences = (await readJson(path.join(galleryRoot, "data/audiences.json"))).items;
const problems = [];

if (check) {
  for (const gallery of galleryNarratives.filter((narrative) => NARRATIVES[narrative.id])) {
    const file = path.join(catalogDir("narratives"), `${gallery.id}.json`);
    const committed = await readJson(file).catch(() => null);
    if (!committed) problems.push(`missing ${path.relative(repoRoot, file)}`);
    else if (q(committed.beats) !== q(narrativeRecord(layoutMap, gallery).beats))
      problems.push(`${gallery.id}: committed beats differ from the gallery data mapped through the layout map`);
  }
  if (q(layoutMap.beats) !== q(beatTable(layoutMap, galleryNarratives)))
    problems.push("gallery-layout-map.json beats table is stale; rerun without --check");
  const coreAudiences = new Set((await readJson(path.join(catalogDir("audiences"), "index.json"))).records.map((r) => r.id));
  for (const audience of galleryAudiences)
    if (!coreAudiences.has(audience.id)) problems.push(`gallery audience '${audience.id}' is not in the core catalog`);
} else {
  const narrativeIndexPath = path.join(catalogDir("narratives"), "index.json");
  let narrativeIndex = await readFile(narrativeIndexPath, "utf8");
  const coreNarratives = new Set(JSON.parse(narrativeIndex).records.map((r) => r.id));
  // Insert in dependency order so a later entry can anchor on an earlier one.
  const pending = galleryNarratives.filter((narrative) => !coreNarratives.has(narrative.id));
  while (pending.length) {
    const next = pending.findIndex((narrative) => {
      const anchor = NARRATIVES[narrative.id]?.after;
      return anchor && narrativeIndex.includes(`"file": "${anchor}.json"`);
    });
    if (next < 0) throw new Error(`no prose or index anchor for ${pending.map((n) => n.id).join(", ")}`);
    const [gallery] = pending.splice(next, 1);
    const record = narrativeRecord(layoutMap, gallery);
    await writeJson(path.join(catalogDir("narratives"), `${gallery.id}.json`), record);
    const marker = `      "file": "${NARRATIVES[gallery.id].after}.json"\n    },\n`;
    const at = narrativeIndex.indexOf(marker);
    if (at < 0) throw new Error(`index anchor ${NARRATIVES[gallery.id].after} is missing or last`);
    narrativeIndex = `${narrativeIndex.slice(0, at + marker.length)}${indexEntry(record)}\n${narrativeIndex.slice(at + marker.length)}`;
  }
  JSON.parse(narrativeIndex);
  await writeFile(narrativeIndexPath, narrativeIndex);

  const audienceIndexPath = path.join(catalogDir("audiences"), "index.json");
  const audienceIndex = await readJson(audienceIndexPath);
  const coreAudiences = new Set(audienceIndex.records.map((r) => r.id));
  for (const gallery of galleryAudiences) {
    const file = path.join(catalogDir("audiences"), `${gallery.id}.json`);
    if (coreAudiences.has(gallery.id)) {
      // Existing record: append the gallery's recommended narratives, keeping the file's formatting.
      let text = await readFile(file, "utf8");
      const record = JSON.parse(text);
      const extra = gallery.recommendedNarratives.filter((id) => !record.recommendedNarratives.includes(id));
      if (!extra.length) continue;
      const match = text.match(/"recommendedNarratives": \[\n([\s\S]*?)\n {2}\]/);
      if (!match) throw new Error(`cannot find recommendedNarratives in ${gallery.id}.json`);
      text = text.replace(match[0], `"recommendedNarratives": [\n${match[1]},\n${extra.map((id) => `    ${q(id)}`).join(",\n")}\n  ]`);
      JSON.parse(text);
      await writeFile(file, text);
      continue;
    }
    const description = AUDIENCE_DESCRIPTIONS[gallery.id];
    if (!description) throw new Error(`no description for gallery audience ${gallery.id}`);
    await writeJson(file, {
      $schema: "https://openpresentation.org/schema/opf-audience/v1",
      id: gallery.id,
      name: gallery.name,
      summary: gallery.summary,
      description,
      seniority: gallery.seniority,
      technicalFluency: gallery.technicalFluency,
      decisionPower: gallery.decisionPower,
      attentionBudgetMinutes: gallery.attentionBudgetMinutes,
      recommendedNarratives: gallery.recommendedNarratives,
      recommendedTones: gallery.recommendedTones,
      tags: gallery.tags,
    });
    audienceIndex.records.push({ id: gallery.id, name: gallery.name, summary: gallery.summary, file: `${gallery.id}.json` });
  }
  await writeJson(audienceIndexPath, audienceIndex);
  await writeJson(mapPath, { ...layoutMap, beats: beatTable(layoutMap, galleryNarratives) });
}

if (problems.length) {
  process.stderr.write(`${problems.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`${check ? "gallery catalogs in sync" : "gallery catalogs synced"} (${galleryRoot})\n`);
