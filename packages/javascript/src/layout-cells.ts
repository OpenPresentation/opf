// OPF 0.35 step 8: a 0.34 slide with a `layout` and promoted-region keys (cells). Through 0.34 the cells composed the slide and the
// layout's regions were not used (composition.ts of v0.34.2: `useTemplate = template !== undefined && !regions.length`), but the layout
// record still reached the slide: resolveDesignHints merged the record's `design` keys under the slide's, the deck's and the theme's,
// with the source `layout` (a centered layout centers only short text, LH-72; a layout's imageFit lets a mosaic cover its pictures);
// its color variant decided the background where the slide and the deck left it open (layoutVariantApplies); and its `composition`
// merged under the slide's. The fix `cells-to-blocks` on such a slide removes `layout`, names the cells on blocks and writes those
// contributions on the slide itself. It is safe only when the slide then composes exactly as the 0.34 slide did: the fix composes both
// (the 0.34 slide as this engine composes cells beside a layout record) and compares them. Only the slide's own keys change (FA-34).
import { composeSlide } from './composition.js';
import { DESIGN_HINT_KEYS, resolveDesignHints } from './design-hints.js';
import type { FindingFix, JsonPatchOperation } from './generated/types/finding.js';
import { isRecord, pointerOf } from './finding-text-util.js';
import { applyPatch } from './patch.js';
import { cellKeysAsBlocks } from './schema-fixes.js';
import { resolveSlideContext, type SlideContextOptions } from './slide-context.js';

/** The design keys a 0.34 layout record could give a slide in cells: the shared design keys 0.34 had (not 0.35's `titlePosition`, which a slide in cells ignores). */
const LAYOUT_DESIGN_KEYS = DESIGN_HINT_KEYS.filter((key) => key !== 'titlePosition');
/** The design keys composition reads differently when they come from a layout (or a theme) than from the slide: written on the slide they may change the drawing. */
const SOURCE_SENSITIVE = ['contentAlignment', 'imageFit'] as const;

/** What a slide with a layout and cell keys took from its layout, and the fix that writes it on the slide. */
export interface LayoutCellsMove {
  /** The layout reference the fix removes. */
  layout: string;
  /** The design keys (and `variant`) the fix writes on the slide's design, as the layout gave them. */
  design: Record<string, unknown>;
  /** The composition keys the fix writes on the slide's composition (the layout record's, under the slide's own). */
  composition: Record<string, unknown>;
  /** True when the fixed slide composes exactly as the 0.34 slide did; the fix is then marked safe. */
  exact: boolean;
  /** Why it is not exact, when it is not. */
  reason?: string;
  fix: FindingFix;
}

type Rec = Record<string, unknown>;

/** A composition and its colors, without the design hints' bookkeeping (where each key came from), as JSON. */
function drawn(slide: Rec, options: ReturnType<typeof resolveSlideContext>['options'], roles: unknown): string {
  const result = composeSlide(slide, options) as unknown as Rec;
  const { sources: _sources, paths: _paths, ...design } = (result.design ?? {}) as Rec;
  return JSON.stringify({ ...result, design, roles });
}

/**
 * The `cells-to-blocks` fix of slide `index` when it has a `layout` and 0.34 cell keys: remove `layout` and the keys, add the blocks that
 * name the cells, and write on the slide's `design` (and `composition`) what the layout record gave the slide. Marked safe when the fixed
 * slide composes exactly as the 0.34 slide did. Undefined when the slide has no such keys, cannot move them as they are
 * (cellKeysAsBlocks), or its context does not resolve.
 */
export function layoutCellsMove(document: unknown, index: number, options: SlideContextOptions = {}): LayoutCellsMove | undefined {
  const slides = isRecord(document) && Array.isArray(document.slides) ? document.slides : [];
  const slide = slides[index];
  if (!isRecord(slide) || typeof slide.layout !== 'string') return undefined;
  const moved = cellKeysAsBlocks(slide, true);
  if (!moved) return undefined;
  const catalogs = { catalogs: options.catalogs };
  let before: ReturnType<typeof resolveSlideContext>;
  try {
    before = resolveSlideContext(document, index, catalogs);
  } catch {
    return undefined;
  }
  const record = before.resolved.layout;
  const design: Rec = {};
  if (record) {
    const hints = resolveDesignHints({ slide, layout: record, theme: { design: before.options.themeDesign }, presentation: document as never, slideIndex: index });
    for (const key of LAYOUT_DESIGN_KEYS) if (hints.sources[key] === 'layout') design[key] = (hints as unknown as Rec)[key];
  }
  // The record's variant, where it decided the background: the slide is drawn on it (a slot, or the variant object with its accent order).
  const variant = before.resolved.layoutVariant;
  if (variant) design.variant = variant.accents ? { ...variant } : variant.background;
  const own = isRecord(slide.composition) ? slide.composition : {};
  const composition = Object.fromEntries(Object.entries(record && isRecord(record.composition) ? record.composition : {}).filter(([key]) => own[key] === undefined));

  const at = (...segments: string[]) => pointerOf(['slides', String(index), ...segments]);
  const operationsFor = (keep: Rec): JsonPatchOperation[] => {
    const operations: JsonPatchOperation[] = [{ op: 'remove', path: at('layout') }, ...moved.keys.map((key) => ({ op: 'remove' as const, path: at(key) })), { op: 'add', path: at('blocks'), value: moved.blocks }];
    const write = (key: 'design' | 'composition', values: Rec) => {
      if (!Object.keys(values).length) return;
      if (isRecord(slide[key])) for (const [name, value] of Object.entries(values)) operations.push({ op: 'add', path: at(key, name), value });
      else operations.push({ op: 'add', path: at(key), value: values });
    };
    write('design', keep);
    write('composition', composition);
    return operations;
  };

  // The 0.34 slide as this engine composes it: the cells as blocks beside the layout record (its design keys keep the source `layout`;
  // without 0.35's titlePosition, which no 0.34 record had), on the colors the layout's variant gave it.
  let exact = false, reason: string | undefined, chosen = design;
  try {
    const cells = cellKeysAsBlocks(before.slide, true);
    const old: Rec = { ...before.slide };
    for (const key of cells?.keys ?? []) delete old[key];
    delete old.layout;
    old.blocks = cells?.blocks ?? moved.blocks;
    const layout34 = record && isRecord(record.design) && 'titlePosition' in record.design ? { ...record, design: Object.fromEntries(Object.entries(record.design).filter(([key]) => key !== 'titlePosition')) } : record;
    const target = drawn(old, { ...before.options, ...(layout34 ? { layout: layout34 } : {}), [Symbol.for('opf.cellsBesideLayout')]: true } as typeof before.options, before.resolved.roles);
    // The candidates: every key the layout gave, then without the keys a slide reads differently (one, then both).
    const sensitive = SOURCE_SENSITIVE.filter((key) => key in design);
    const without = (keys: readonly string[]) => Object.fromEntries(Object.entries(design).filter(([key]) => !keys.includes(key)));
    const candidates = [design, ...sensitive.map((key) => without([key])), ...(sensitive.length > 1 ? [without(sensitive)] : [])];
    for (const candidate of candidates) {
      const fixed = applyPatch(document, operationsFor(candidate));
      const after = resolveSlideContext(fixed, index, catalogs);
      if (drawn(after.slide, after.options, after.resolved.roles) === target) { exact = true; chosen = candidate; break; }
    }
    if (!exact) {
      // Which part of the record a slide cannot say: its regions (rules that read the record's template still shaped the cells in
      // 0.34, such as the quote's larger text), else the design keys composition reads differently from a layout.
      const designOnly = record ? drawn(old, { ...before.options, layout: { design: (layout34 as Rec).design ?? {}, composition: record.composition ?? {} }, [Symbol.for('opf.cellsBesideLayout')]: true } as typeof before.options, before.resolved.roles) : target;
      reason = designOnly !== target
        ? `the layout record's regions also shaped how its cells drew (rules that read the record's template, such as the larger text of a quote), which no key of a slide without the layout says`
        : sensitive.length
          ? `the layout's ${sensitive.join(' and ')} drew differently from the same key on the slide (a centered layout centers only short text; a layout's imageFit lets a mosaic cover its pictures)`
          : 'the slide does not compose the same without its layout';
    }
  } catch (error) {
    reason = `the slide could not be composed (${error instanceof Error ? error.message : String(error)})`;
  }
  const kept = [...Object.keys(chosen).map((key) => `design.${key}`), ...Object.keys(composition).map((key) => `composition.${key}`)];
  const title = `Name the cells and remove layout${kept.length ? ` (keep its ${kept.join(', ')})` : ''}`;
  return { layout: slide.layout, design: chosen, composition, exact, ...(reason ? { reason } : {}), fix: { id: 'cells-to-blocks', title, kind: 'patch', safe: exact, patch: operationsFor(chosen) } };
}
