// Shared helpers of the core tests that check a presentation's format. Not a test: it lives below test/ so that
// scripts/run-tests.mjs (which runs test/*.mjs only) never runs it.
import { validate } from '../../dist/index.js';

/** The format check: what pagination, conversion and the editor run on every edit. Pass options for more. */
export const check = (document, options = {}) => validate(document, { only: ['format'], ...options });

/** Findings of one severity. */
export const errorsOf = (report) => report.findings.filter((entry) => entry.severity === 'error');
export const warningsOf = (report) => report.findings.filter((entry) => entry.severity === 'warning');

/** The rule ids of a report's findings, in order. */
export const ruleIds = (report) => report.findings.map((entry) => entry.ruleId);
