import assert from 'node:assert/strict';
// List regions require OPF items; legacy bullets are text-kind blocks.
// A parent/child arrangement needs one root with children, retaining every label.
export function fontSwitchListBlock(labels, layout, {supplementalLabel} = {}) {
  const flat = regions => (regions ?? []).flatMap(region => region.regions ? flat(region.regions) : [region]);
  const regions = flat(layout?.regions);
  const tree = regions.some(region => ['org-chart', 'hierarchy'].includes(region.arrangement));
  const items = labels.map((text,index) => ({text, ...(tree ? {level:index===0?0:1} : {})}));
  if (regions.some(region => region.arrangement === 'matrix') && items.length === 3) {
    assert.ok(typeof supplementalLabel === 'string' && supplementalLabel.length > 0, 'matrix fixture requires a fourth localized label');
    items.push({text:supplementalLabel});
  }
  return {items};
}
