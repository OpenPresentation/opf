// Bisect decks for explicit-chart-reference-lines: each slide alone, with and without its reference lines.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const d = JSON.parse(readFileSync(src, 'utf8'));
const names = ['line', 'column-pct', 'combo-secondary', 'bar', 'line-markers-single'];
d.slides.forEach((s, i) => {
  const tag = `r${i + 1}-${names[i]}`;
  writeFileSync(`${out}/${tag}.opf.json`, JSON.stringify({ ...d, name: tag, slides: [s] }, null, 1));
  const { referenceLines, ...chart } = s.chart;
  writeFileSync(`${out}/${tag}-norefs.opf.json`, JSON.stringify({ ...d, name: `${tag}-norefs`, slides: [{ ...s, chart }] }, null, 1));
});
console.log('ok');
