// Authored picker examples are separate from the exhaustive stability fixtures.
// All people, quotations and business figures below are illustrative.
import { templateDeck } from './fixtures.mjs';

const TITLES = {
  cover: 'A smaller pilot. A clearer decision.', section: 'Test before scaling',
  statement: 'Start small enough to learn quickly', closing: 'Agree the pilot team and start date',
  text: 'Learn before scaling', list: 'Make the next step explicit',
  'two-column': 'Opportunity and constraints',
  quote: 'A shared view makes decisions easier', metrics: 'Pilot outcomes in three measures',
  chart: 'Completion rose through the pilot', 'chart-beside': 'The largest gain came in week four',
  table: 'Compare outcomes on consistent measures', 'table-beside': 'Team B needs targeted support',
  dashboard: 'Pilot performance at a glance', faq: 'What the pilot involves',
  process: 'Three steps from evidence to decision', team: 'Give each workstream a clear owner',
  agenda: 'From the problem to the next decision', comparison: 'Choose the smallest useful test',
  pillars: 'Three conditions for a useful pilot', timeline: 'Six weeks to an informed decision',
  'image-beside': 'Explain what the audience should notice', image: 'Give the visual room to speak',
  gallery: 'Compare three visual directions', hero: 'One team. One outcome.',
  code: 'Keep the implementation easy to inspect', scorecard: 'Track performance against a target',
  logos: 'Recognize the partners',
};
const METRICS = [
  { value: 52, label: 'Trial participants', description: 'Illustrative six-week pilot' },
  { value: '84%', label: 'Task completion', description: 'Up from 68% at baseline' },
  { value: '6.2', unit: 'min', label: 'Median task time', description: 'Down from 9.4 min' },
];
const QUESTIONS = [
  ['Who takes part?', 'Two field teams, with 52 participants in total.'],
  ['How long does it run?', 'Six weeks, including a baseline measurement.'],
  ['What happens next?', 'Review completion and task time before expanding.'],
];
const STEPS = [
  ['1. Establish a baseline', 'Measure the current completion rate and task time.'],
  ['2. Run the pilot', 'Test with two teams and review feedback each week.'],
  ['3. Decide what to scale', 'Compare outcomes with the baseline and agree the next step.'],
];
const PEOPLE = [
  ['Ana Ruiz', 'Pilot lead', 'Coordinates the two teams and weekly reviews.'],
  ['Sam Lee', 'Product lead', 'Turns participant feedback into product changes.'],
  ['Kai Moreau', 'Analytics lead', 'Measures completion and task time consistently.'],
];
const chart = (index) => ({ chart: {
  type: index ? 'line' : 'column', axisTitles: { category: 'Week', value: 'Task completion' },
  data: { columns: ['Week', { name: 'Task completion', format: '0%' }],
    rows: [['1', .68], ['2', .72], ['3', .76], ['4', .84]] },
} });
const table = () => ({ table: {
  columns: ['Team', { name: 'Participants', format: '0' }, { name: 'Completion', format: '0%' }, { name: 'Median time (min)', format: '0.0' }],
  rows: [['A', 28, .89, 5.8], ['B', 24, .79, 6.7]],
} });

export function editorialDeck(id, record) {
  const deck = templateDeck(id, record);
  const slide = deck.slides[0];
  slide.title = TITLES[id] ?? record.name;
  slide.subtitle = 'Illustrative example • fictional data';
  if (id === 'metrics') slide.design = { titleAlignment: 'center' };
  deck.design = { background: 'light1' };
  const counts = {};
  slide.blocks = (slide.blocks ?? []).map((block) => {
    const kind = Object.keys(block).find(key => key !== 'region');
    const index = counts[kind] ?? 0;
    counts[kind] = index + 1;
    let payload;
    if (id === 'faq') payload = { text: QUESTIONS[index % 3].join('\n') };
    else if (id === 'process') payload = { text: STEPS[index % 3].join('\n') };
    else if (id === 'team') payload = { text: PEOPLE[index % 3].join('\n') };
    else if (id === 'agenda') payload = { items: ['Define the problem', 'Review the pilot evidence', 'Agree the next decision'] };
    else if (id === 'pillars') payload = { text: ['Clear scope\nTwo teams and one workflow keep the pilot focused.', 'Consistent measures\nTrack completion and task time against a baseline.', 'An explicit decision\nAgree the evidence needed before expanding.'][index % 3] };
    else if (id === 'comparison') payload = { text: ['Option A: focused pilot\nTwo teams, six weeks. Low setup cost and a clear baseline.', 'Option B: broad rollout\nAll teams, three months. Wider reach with greater coordination needs.', 'Recommendation: establish the evidence with Option A before committing to Option B.'][index % 3] };
    else if (kind === 'metric') payload = { metric: id === 'scorecard' ? { ...METRICS[index % 3], description: ['Target: 50 participants', 'Target: at least 80%', 'Target: under 7 min'][index % 3] } : METRICS[index % 3] };
    else if (kind === 'chart') payload = index === 0 ? chart(0) : { chart: { type: 'bar', axisTitles: { value: 'Median task time (min)' }, data: { columns: ['Team', { name: 'Median task time (min)', format: '0.0' }], rows: [['A', 5.8], ['B', 6.7]] } } };
    else if (kind === 'table') payload = table();
    else if (kind === 'quote') payload = { quote: {
      text: ['We can now see where participants need help.', 'The weekly review keeps the next step clear.', 'Measure the outcome before expanding the rollout.'][index % 3],
      attribution: ['Pilot lead', 'Product lead', 'Analytics lead'][index % 3],
      source: 'Illustrative quotation',
    } };
    else if (kind === 'timeline') payload = { timeline: { events: [{ when: 'Week 1', what: 'Baseline' }, { when: 'Weeks 2–5', what: 'Pilot' }, { when: 'Week 6', what: 'Review and decide' }] } };
    else if (id === 'logos') {
      const name = ['NORTH', 'FIELD', 'STUDIO'][index % 3];
      const marks = [
        '<path d="M220 170V70l160 100V70" fill="none" stroke="#263445" stroke-width="24"/>',
        '<path d="M230 60h140v24H254v34h96v24h-96v38h-24z" fill="#263445"/>',
        '<circle cx="300" cy="120" r="72" fill="none" stroke="#263445" stroke-width="20"/><path d="M260 120h80M300 80v80" stroke="#263445" stroke-width="18"/>',
      ];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240"><rect width="600" height="240" fill="#f0f0f0"/>${marks[index % 3]}</svg>`;
      payload = { image: { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, alt: `${name}, fictional geometric mark` } };
    }
    else if (id === 'gallery' && kind === 'image') {
      const source = Buffer.from(block.image.src.split(',')[1], 'base64').toString();
      const variants = [['#7aa7e6','#cfe0f5','#3f8a55','#2f6b42'], ['#d49b74','#fae5cb','#b96b50','#854b48'], ['#9a8fbe','#eee8f5','#756b96','#514767']][index % 3];
      let variant = source; ['#7aa7e6','#cfe0f5','#3f8a55','#2f6b42'].forEach((color,i) => { variant = variant.replaceAll(color,variants[i]); });
      payload = { image: { src: `data:image/svg+xml;base64,${Buffer.from(variant).toString('base64')}`, alt: ['Blue and green landscape palette','Warm earth landscape palette','Purple landscape palette'][index % 3] } };
    }
    else if (kind === 'image') payload = { image: { ...block.image, alt: 'Illustrative landscape with two green ridges' } };
    else if (id === 'code' && kind === 'text') payload = { text: 'The reducer adds each item’s value to a running sum. Starting at zero also makes an empty list return zero.' };
    else if (id === 'closing') payload = { text: 'Next step: name the pilot lead and agree the start date.' };
    else if (kind === 'text') payload = { text: id === 'statement'
      ? 'Learn with two teams before expanding the rollout.'
      : ['Test with two teams for six weeks. Measure task completion and time before deciding what to scale.',
        'Keep the scope narrow, collect feedback weekly and give each decision a named owner.',
        'Compare the results with the baseline. Expand only when the evidence supports the next step.'][index % 3] };
    else payload = Object.fromEntries(Object.entries(block).filter(([key]) => key !== 'region'));
    return { region: block.region, ...payload };
  });
  // A team example need not invent portraits. Use names and responsibilities honestly.
  // Charts and tables show one analytical object per region instead of three tiny copies.
  if (['chart', 'chart-beside', 'table', 'table-beside', 'quote', 'agenda', 'closing', 'code', 'timeline', 'image-beside'].includes(id)) {
    const seen = new Set();
    slide.blocks = slide.blocks.filter(block => {
      if (seen.has(block.region)) return false;
      seen.add(block.region); return true;
    });
  }
  if (id === 'dashboard') {
    let charts = 0;
    slide.blocks = slide.blocks.filter(block => !block.chart || ++charts <= 2);
  }
  if (!slide.blocks.length) delete slide.blocks;
  deck.slides = [slide];
  return deck;
}
