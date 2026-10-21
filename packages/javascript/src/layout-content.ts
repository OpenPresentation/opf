import { isLayoutTemplate, layoutEntries } from './layout-template.js';

/** Body content kinds accepted by template regions. */
export const LAYOUT_BODY_KINDS = ['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline'] as const;
export type LayoutBodyKind = typeof LAYOUT_BODY_KINDS[number];

/** What a layout template holds, derived from its regions. */
export interface LayoutContent {
  /** First non-group kind accepted by its first primary region, or title without body regions. */
  kind: LayoutBodyKind | 'title';
  /** Number of body regions. */
  count: number;
  /** Heading fields the template has areas for. */
  heading: { title: boolean; subtitle: boolean; tag: boolean };
}

/** The template areas in reading order, with each body's flow and accepted kinds. */
export function layoutStructure(layout: unknown): string {
  if (!isLayoutTemplate(layout)) return '';
  return layoutEntries(layout).map(entry => entry.region ? `${entry.name} (${entry.region.flow}: ${entry.region.accepts.join(', ')})` : entry.name).join(', ');
}

/** Derive the body kind, region count and headings from a template record. */
export function layoutContent(layout: unknown): LayoutContent {
  const areas = isLayoutTemplate(layout) ? layoutEntries(layout) : [];
  const regions = areas.flatMap(entry => entry.region ? [entry.region] : []);
  const lead = regions.find(region => region.role === 'primary') ?? regions[0];
  const leadKind = lead?.accepts.find(kind => kind !== 'group');
  const title = areas.some(entry => entry.name === 'title');
  return { kind: leadKind ?? 'title', count: regions.length, heading: { title, subtitle: title || areas.some(entry => entry.name === 'subtitle'), tag: title } };
}
