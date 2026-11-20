// Test-only forwarding: count real complete review validations, never replace their reports.
export * from '../../../javascript/dist/browser.js';
import { createValidator as original, validate } from '../../../javascript/dist/browser.js';
export const probe = globalThis.__navigationReviewProbe ??= { calls: 0 };
export function createValidator() {
  const checker = original();
  return {
    get cache() { return checker.cache; },
    clear: () => checker.clear(),
    validate(input, options) {
      probe.calls++;
      const report = checker.validate(input, options);
      probe.latest = { input, options, report };
      return report;
    },
  };
}
probe.oracle = () => {
  const { input, options, report } = probe.latest;
  return { same: JSON.stringify(report) === JSON.stringify(validate(input, options)), report };
};
