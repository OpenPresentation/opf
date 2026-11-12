import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const d = JSON.parse(readFileSync(src, 'utf8'));
const variants = {};
const names = ['bar', 'scatter', 'pie'];
d.slides.forEach((s, i) => {
  variants[`a-${names[i]}`] = [s];
  const { shapes, ...noShapes } = s;
  variants[`b-${names[i]}-noshapes`] = [noShapes];
});
variants['b-all-noshapes'] = d.slides.map(({ shapes, ...r }) => r);
for (const [k, slides] of Object.entries(variants)) {
  writeFileSync(`${out}/${k}.opf.json`, JSON.stringify({ ...d, name: k, slides }, null, 1));
}
console.log(Object.keys(variants).join(' '));
