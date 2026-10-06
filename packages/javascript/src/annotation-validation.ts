import { collectCitations, walkCitationRuns } from './annotations.js';
import { isRecord, pathFor, visitContentPayloads } from './content-walk.js';
import type { ValidationIssue } from './validator.js';

/**
 * Semantic checks for footnotes, citations and captions (RR-34). Errors:
 * - `reference-id-duplicate`: two `references` entries share an id.
 * - `cite-unknown-reference`: a run cites an id the references list does not hold.
 * - `cite-unsupported-location`: `cite`/`footnote` on a run outside the slide title, subtitle and tag, text, bullets, list items and quote text
 *   (table cells, captions, reference and footnote texts), where no engine draws a marker.
 * Warnings (lint `opf/unused-reference`): a reference no run cites.
 */

const issue = (path: string, message: string, params: Record<string, unknown>): ValidationIssue => ({ path, message, keyword: 'opf', schemaPath: '#/x-opf-semantics', params });
const pointer = (dotted: string): string => `/${dotted.split('.').map(part => part.replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;

function markedRuns(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((run, index) => isRecord(run) && (run.cite !== undefined || run.footnote !== undefined) ? [index] : []);
}

export function annotationIssues(value: unknown): ValidationIssue[] {
  if (!isRecord(value) || !Array.isArray(value.slides)) return [];
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  if (Array.isArray(value.references)) value.references.forEach((reference, index) => {
    if (!isRecord(reference) || typeof reference.id !== 'string') return;
    if (ids.has(reference.id)) issues.push(issue(`/references/${index}/id`, `reference id '${reference.id}' is used by an earlier references entry; ids must be unique`, { code: 'reference-id-duplicate', id: reference.id }));
    ids.add(reference.id);
    for (const runIndex of markedRuns(reference.text)) issues.push(issue(`/references/${index}/text/${runIndex}`, 'reference text cannot cite or carry a footnote', { code: 'cite-unsupported-location' }));
  });
  const unsupported = (runs: unknown, path: string, where: string) => {
    for (const runIndex of markedRuns(runs)) issues.push(issue(`${path}/${runIndex}`, `cite and footnote are not supported in ${where}; markers are drawn only in the slide title, subtitle and tag, text, bullets, list items and quote text`, { code: 'cite-unsupported-location' }));
  };
  const cell = (entry: unknown, path: string) => {
    if (Array.isArray(entry)) unsupported(entry, path, 'table cells');
    else if (isRecord(entry) && Array.isArray(entry.value)) unsupported(entry.value, pathFor(path, 'value'), 'table cells');
  };
  const payload = (node: Record<string, unknown>, path: string) => {
    if (isRecord(node.table)) {
      const table = node.table, tablePath = pathFor(path, 'table');
      if (Array.isArray(table.columns)) table.columns.forEach((column, index) => { cell(column, `${pathFor(tablePath, 'columns')}/${index}`); });
      if (Array.isArray(table.rows)) table.rows.forEach((row, rowIndex) => { if (Array.isArray(row)) row.forEach((entry, cellIndex) => { cell(entry, `${pathFor(tablePath, 'rows')}/${rowIndex}/${cellIndex}`); }); });
    }
    if (node.caption !== undefined) {
      const caption = node.caption, captionPath = pathFor(path, 'caption');
      if (Array.isArray(caption)) unsupported(caption, captionPath, 'captions');
      else if (isRecord(caption) && Array.isArray(caption.text)) unsupported(caption.text, pathFor(captionPath, 'text'), 'captions');
    }
  };
  value.slides.forEach((slide, index) => {
    if (!isRecord(slide)) return;
    const slidePath = `/slides/${index}`;
    payload(slide, slidePath);
    visitContentPayloads(slide, slidePath, payload);
    walkCitationRuns(slide, `slides.${index}`, entry => {
      const runPath = pointer(entry.path);
      const cite = entry.run.cite;
      if (typeof cite === 'string') { if (!ids.has(cite)) issues.push(issue(`${runPath}/cite`, `unknown reference '${cite}'; add it to the top-level references list`, { code: 'cite-unknown-reference', id: cite })); }
      else if (Array.isArray(cite)) cite.forEach((id, position) => { if (typeof id === 'string' && !ids.has(id)) issues.push(issue(`${runPath}/cite/${position}`, `unknown reference '${id}'; add it to the top-level references list`, { code: 'cite-unknown-reference', id })); });
      if (Array.isArray(entry.footnote)) unsupported(entry.footnote, `${runPath}/footnote`, 'footnote text');
    });
  });
  return issues;
}

/** References no run cites, as advisory issues (lint reports them as `opf/unused-reference`). */
export function unusedReferenceWarnings(value: unknown): ValidationIssue[] {
  if (!isRecord(value) || !Array.isArray(value.references) || !Array.isArray(value.slides)) return [];
  const { unused } = collectCitations(value);
  return value.references.flatMap((reference, index) => isRecord(reference) && typeof reference.id === 'string' && unused.includes(reference.id)
    ? [issue(`/references/${index}`, `reference '${reference.id}' is never cited; cite it with a run's cite field or remove it`, { code: 'unused-reference', id: reference.id })]
    : []);
}
