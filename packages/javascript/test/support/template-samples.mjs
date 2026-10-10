// Sample content for the 0.19 layout templates, shared by the composition goldens and the geometry invariants. Not a test.
import { readFileSync } from "node:fs";
import { layoutTemplate } from "../../dist/composition.js";

/** The 28 built-in templates (the design doc's, until @openpresentation/gallery 2.0.0 ships them). */
export const { layouts } = JSON.parse(readFileSync(new URL("../fixtures/layout-templates-0.19.json", import.meta.url), "utf8"));

const long = 'Customers told us onboarding took too long, so we rebuilt it around three steps, measured every one of them and removed the two that nobody needed; the flow now takes four minutes instead of twenty.';
export const payload = (kind, index, size) => {
  const big = size === 'long';
  switch (kind) {
    case 'text': return { text: big ? `${index + 1}. ${long}` : `Point ${index + 1}` };
    case 'list': return { items: Array.from({ length: big ? 7 : 3 }, (_, item) => (big ? `Item ${item + 1}: ${long.slice(0, 70)}` : `Item ${item + 1}`)) };
    case 'image': return { image: { src: `https://example.com/picture-${index + 1}.png`, alt: `Picture ${index + 1}` } };
    case 'chart': return { chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 4.1 + index], ['Q2', 4.5], ['Q3', 5.2]] } } };
    case 'table': return { table: { columns: ['Plan', 'Seats', 'Price'], rows: Array.from({ length: big ? 9 : 3 }, (_, row) => [`Plan ${row + 1}`, String(10 * (row + 1)), `$${row + 5}`]) } };
    case 'code': return { code: { language: 'js', source: Array.from({ length: big ? 16 : 3 }, (_, line) => `const value${line} = compute(${line});`).join('\n') } };
    case 'metric': return { metric: { value: `${40 + index}%`, label: big ? long.slice(0, 90) : `Metric ${index + 1}` } };
    case 'quote': return { quote: { text: big ? long : 'It just works.', attribution: `Person ${index + 1}` } };
    case 'timeline': return { timeline: { events: Array.from({ length: big ? 6 : 3 }, (_, event) => ({ when: `Q${event + 1}`, what: big ? `Milestone ${event + 1} with a longer description` : `Step ${event + 1}` })) } };
    default: throw new Error(kind);
  }
};
/** The kinds a sample slide uses: each region's first accepted kind (videos drawn as pictures), the first primary region first. */
export const sampleKinds = (record) => {
  const template = layoutTemplate(record);
  const regions = [...template.regions].sort((a, b) => (a.role === 'primary' ? 0 : 1) - (b.role === 'primary' ? 0 : 1));
  return regions.map((region) => region.accepts.find((kind) => kind !== 'group' && kind !== 'video') ?? 'image');
};
/** The sample slide of a template: `count` blocks of short or long content and a short or long title. */
export const sampleSlide = (record, count, size) => {
  const kinds = sampleKinds(record);
  const blocks = Array.from({ length: count }, (_, index) => payload(kinds.length ? kinds[index % kinds.length] : "text", index, size));
  return { title: size === "long" ? `${record.name}: a longer title that may need a second line on the slide` : record.name, blocks };
};
