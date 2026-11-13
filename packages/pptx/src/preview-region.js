// SH-16, RR-105: a region of OPF's own preview of a slide (opf-render's traced SVG, src/smart-art.js smartArtSlideSvg), cut out as
// a standalone SVG for a fallback picture: the picture an app shows when it cannot draw the live object in an mc:AlternateContent
// (a SmartArt frame, an extended chart).

// A tag of the renderer's SVG (quoted attribute values may hold `>`), a comment, CDATA or a processing instruction.
const SVG_TAG = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g;
export const svgAttribute = (attributes, name) => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`).exec(attributes)?.[1];
const svgNumber = value => String(Number(value.toFixed(4)));

/**
 * The elements of the slide's SVG that `classify(name, attributes)` names (each with its ancestors, so their transforms and clips
 * apply), with the definitions they use, cropped to `box` (canvas px). Only top-level elements are classified: nothing inside a kept
 * element, and `defs` and `style` children of the root are the definitions. `pick(found)` chooses the kept elements from the
 * classified ones ({kind, start, text}) or returns undefined, which throws `missing`. Nothing else of the slide is drawn, so the
 * picture is transparent around them.
 */
export function previewRegionSvg(svg, {classify, pick, box, missing}) {
  const stack = [], found = [];
  let root;
  for (const match of svg.matchAll(SVG_TAG)) {
    const [text, closing, name, attributes = '', selfClosing] = match;
    if (!name) continue;
    if (closing) {
      const open = stack.pop();
      if (open?.kind) found.push({kind: open.kind, start: open.start, text: open.ancestors.map(entry => entry.text).join('') + svg.slice(open.start, match.index + text.length) + open.ancestors.map(entry => `</${entry.name}>`).reverse().join('')});
      continue;
    }
    if (root === undefined) { root = attributes; stack.push({name, text}); continue; }
    const inside = stack.some(entry => entry.kind);
    const kind = inside ? undefined : stack.length === 1 && (name === 'defs' || name === 'style') ? 'defs' : classify(name, attributes);
    const entry = {name, text, kind, start: match.index, ancestors: kind ? stack.slice(1).map(({name, text}) => ({name, text})) : []};
    if (!selfClosing) stack.push(entry);
    else if (kind) found.push({kind, start: entry.start, text: entry.ancestors.map(item => item.text).join('') + text + entry.ancestors.map(item => `</${item.name}>`).reverse().join('')});
  }
  const kept = root === undefined ? undefined : pick(found);
  if (!kept) throw new Error(missing);
  const strip = value => value.replace(/\sdata-opf-[\w-]+\s*=\s*"[^"]*"/g, '');
  const body = strip([...kept].sort((a, b) => a.start - b.start).map(entry => entry.text).join(''));
  // The glyph outlines and other definitions the kept elements use; the slide's other glyphs are left out.
  const used = new Set([...body.matchAll(/(?:href="#|url\(#)([^")]+)/g)].map(match => match[1]));
  const definitions = strip(found.filter(entry => entry.kind === 'defs').sort((a, b) => a.start - b.start).map(entry => entry.text).join(''))
    .replace(/<path id="(opf-g-[^"]+)"[^>]*\/>/g, (all, id) => used.has(id) ? all : '');
  const namespaces = [...root.matchAll(/\s(xmlns(?::[\w.-]+)?)\s*=\s*"([^"]*)"/g)].filter(([, key]) => key !== 'xmlns').map(([, key, value]) => ` ${key}="${value}"`).join('');
  const [x, y, width, height] = [box.x, box.y, box.width, box.height].map(svgNumber);
  return `<svg xmlns="http://www.w3.org/2000/svg"${namespaces} width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">${definitions}${body}</svg>`;
}

/**
 * RR-105: OPF's preview of one chart, the chart the preview draws at `path` (opf-render's `<g data-opf-chart>` of that item:
 * its marks, axes, labels, legend and header), cropped to `box` (canvas px, the chart's frame). The picture an app without
 * extended charts shows in place of an extended (chartex) chart.
 */
export function chartRegionSvg(svg, path, box) {
  return previewRegionSvg(svg, {
    classify: (name, attributes) => name === 'g' && svgAttribute(attributes, 'data-opf-chart') !== undefined && svgAttribute(attributes, 'data-opf-path') === path ? 'chart' : undefined,
    pick: found => { const chart = found.find(entry => entry.kind === 'chart'); return chart ? [chart] : undefined; },
    box, missing: `the preview draws no chart at ${path}`,
  });
}
