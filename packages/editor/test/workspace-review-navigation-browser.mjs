import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';

// Count the actual validator, retain complete cold-report equality, and await the actual review idle contract.
// There are no elapsed-time pass thresholds or skipped document/resource checks.
const app = await startWorkspacePage({ bundle: { exactAliases: {
  '@openpresentation/opf': fileURLToPath(new URL('./support/navigation-counted-core.mjs', import.meta.url)),
} } });
try {
  const result = await app.page.evaluate(async document => {
    const probe = window.__navigationReviewProbe;
    let pending = false, release, resourceWait, failPreparation = false;
    const preparationErrors = [];
    const fonts = { ...window.fonts,
      pending(deck, options) { return pending ? ['controlled-resource'] : window.fonts.pending(deck, options); },
      async ensure(deck, options) {
        if (pending) await resourceWait;
        if (failPreparation) throw new Error('Controlled preparation failure');
        return window.fonts.ensure(deck, options);
      },
    };
    const editor = window.opfWs.createOpfEditor(window.document.querySelector('#host'), { document, fonts, catalogs: [window.opfWs.gallery], layout: 'full', onError: error => preparationErrors.push(error.code) });
    const idle = async () => { await editor.whenIdle(); await editor.review.whenIdle(); };
    const check = () => { const oracle = probe.oracle(); if (!oracle.same) throw Error('Complete report differs from cold validation'); return oracle.report; };
    await editor.ready; await idle(); check();
    const counts = { initial: probe.calls };
    editor.setSlide(1); await idle(); check(); counts.navigation = probe.calls;
    editor.setSlide(1); await idle(); check(); counts.sameSlide = probe.calls;

    // A genuine pending document review survives navigation; navigation must not cancel its timer or leave stale findings.
    editor.session.set('slides.0.title', '');
    editor.setSlide(0); await idle();
    counts.invalid = probe.calls;
    const invalid = check().findings.some(finding => finding.ruleId === 'opf/missing-slide-title');
    editor.session.set('slides.0.title', 'Repaired title');
    editor.setSlide(1); await idle();
    counts.valid = probe.calls;
    const repaired = !check().findings.some(finding => finding.ruleId === 'opf/missing-slide-title');

    // New registered catalog identity invalidates the session snapshot even without a document edit.
    editor.session.setCatalogs([{ ...window.opfWs.gallery }]); await idle(); check(); counts.catalog = probe.calls;
    // Public refresh still observes host resources changed in place; it never takes the navigation reuse path.
    await editor.refresh(); await idle(); check(); counts.explicit = probe.calls;

    // Controlled asynchronous resource preparation, including an edit and navigation superseding older deliveries.
    pending = true;
    resourceWait = new Promise(resolve => { release = resolve; });
    const first = editor.refresh();
    editor.session.set('slides.0.title', 'Newest pending edit');
    editor.setSlide(0);
    pending = false; release();
    await first; await idle();
    counts.resource = probe.calls;
    const latest = probe.latest.input.slides[0].title;
    check();
    editor.setSlide(1); await idle(); check(); counts.afterResourceNavigation = probe.calls;
    pending = true; failPreparation = true; resourceWait = Promise.resolve();
    await editor.refresh(); counts.failedResource = probe.calls;
    pending = false; failPreparation = false;
    editor.setSlide(0); await idle(); check(); counts.recoveredResource = probe.calls;
    const beforeDestroy = probe.calls;
    editor.destroy();
    return { counts, invalid, repaired, latest, beforeDestroy, preparationErrors, workspaceCount: window.document.querySelectorAll('.opf-ws').length };
  }, deck(3));
  console.log(JSON.stringify({ scope: 'actual completed control outcomes before assertions', ...result }));
  const c = result.counts;
  assert.equal(c.navigation, c.initial, 'navigation reuses complete current findings');
  assert.equal(c.sameSlide, c.initial, 'same-slide navigation does not validate again');
  assert.equal(c.invalid, c.initial + 1, 'pending edit still checks once');
  assert.equal(c.valid, c.invalid + 1, 'repair checks once');
  assert.ok(result.invalid && result.repaired, 'real invalid and repaired findings remain visible');
  assert.equal(c.catalog, c.valid + 1, 'catalog replacement is checked');
  assert.equal(c.explicit, c.catalog + 1, 'explicit public refresh is checked');
  assert.equal(c.resource, c.explicit + 1, 'latest resource delivery validates the current edit once');
  assert.equal(result.latest, 'Newest pending edit', 'stale async delivery cannot qualify the older document');
  assert.equal(c.afterResourceNavigation, c.resource, 'later navigation reuses the newly qualified findings');
  assert.equal(c.failedResource, c.afterResourceNavigation, 'failed preparation does not pretend a new review completed');
  assert.equal(c.recoveredResource, c.failedResource + 1, 'navigation after resource failure must revalidate on recovery');
  assert.ok(result.preparationErrors.length > 0 && result.preparationErrors.every(code => code === 'fonts-unavailable'), 'preparation failure is surfaced');
  assert.equal(result.workspaceCount, 0);
  assert.deepEqual(app.errors, []);
  console.log(JSON.stringify({ status: 'PASS', scope: 'actual validator call counts and complete cold reports', ...result }));
} finally { await app.close(); }
