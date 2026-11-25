import { isRecord } from './content-walk.js';
import type { ValidationIssue } from './generated/types/finding.js';

/**
 * Links to a slide of the same deck (FR-03). A link is `slide:<id>` wherever a link is allowed (a text run, a shape block, an
 * overlay shape; a table cell carries runs), spelled like `asset:<id>` and `var:<id>`. The id names a slide's `id`.
 *
 * Error `opf/slide-link-unknown`: a link names a slide id no slide of the document has. A link cannot name a slide that has no
 * `id`; `assignIds` gives every slide one.
 */

const PREFIX = 'slide:';

/** The slide id a link names, or undefined for any other link (an http(s), mailto or tel link, or no link). */
export function slideLinkId(link: unknown): string | undefined {
  return typeof link === 'string' && link.startsWith(PREFIX) && link.length > PREFIX.length ? link.slice(PREFIX.length) : undefined;
}

/** The `link` of one slide link as written: `slide:<id>`. */
export function slideLink(id: string): string {
  return `${PREFIX}${id}`;
}

const pointerToken = (key: string | number): string => String(key).replaceAll('~', '~0').replaceAll('/', '~1');

/** Every slide link in a value, with its JSON Pointer. `extensions` objects are opaque and skipped. */
export function collectSlideLinks(value: unknown, base = ''): Array<{ pointer: string; id: string }> {
  const found: Array<{ pointer: string; id: string }> = [];
  const visit = (node: unknown, pointer: string, depth: number): void => {
    if (depth > 64) return;
    if (Array.isArray(node)) {
      for (const [index, child] of node.entries()) visit(child, `${pointer}/${index}`, depth + 1);
      return;
    }
    if (!isRecord(node)) return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'extensions') continue;
      if (key === 'link') {
        const id = slideLinkId(child);
        if (id !== undefined) found.push({ pointer: `${pointer}/link`, id });
        continue;
      }
      visit(child, `${pointer}/${pointerToken(key)}`, depth + 1);
    }
  };
  visit(value, base, 0);
  return found;
}

/** Slide links that name no slide of the document, as issues (reported as `opf/slide-link-unknown`). */
export function slideLinkIssues(value: unknown): ValidationIssue[] {
  if (!isRecord(value) || !Array.isArray(value.slides)) return [];
  const ids = new Set<string>();
  for (const slide of value.slides) if (isRecord(slide) && typeof slide.id === 'string') ids.add(slide.id);
  const issues: ValidationIssue[] = [];
  value.slides.forEach((slide, index) => {
    for (const { pointer, id } of collectSlideLinks(slide, `/slides/${index}`)) {
      if (ids.has(id)) continue;
      issues.push({
        path: pointer,
        message: `unknown slide '${id}'; a slide link names the 'id' of a slide of this document (assignIds gives every slide one)`,
        keyword: 'opf',
        schemaPath: '#/x-opf-semantics',
        params: { code: 'slide-link-unknown', id },
      });
    }
  });
  return issues;
}
