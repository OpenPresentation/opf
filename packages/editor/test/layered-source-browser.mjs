import assert from 'node:assert/strict';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';

// CE-30 in a real browser: a workspace with a source pane under styles.layered.css looks exactly as under styles.css. CodeMirror injects its own
// theme as unlayered rules, which beat every layered rule, so the package's rules for CodeMirror's elements stay outside the `opf` layer
// (scripts/build-styles.mjs). Here the code's geometry (the editor, the gutters, the content, every line, the hanging indent) and the computed
// styles of every element CodeMirror builds must be the same with either sheet, for the full layout and the source layout.
const checks = [];
const mark = (name) => checks.push(name);
const PROPERTIES = ['padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'margin-left', 'text-indent', 'font-family', 'font-size', 'line-height', 'color', 'background-color', 'border-right-width', 'border-top-width', 'min-width', 'white-space'];

async function look(layered, layout) {
  const app = await startWorkspacePage({ layered });
  try {
    return await app.page.evaluate(async ({ d, layout, properties }) => {
      const host = document.querySelector('#host');
      const editor = window.opfWs.createOpfEditor(host, { document: d, layout, fonts: window.fonts, catalogs: [window.opfWs.gallery] });
      await editor.ready;
      await editor.whenIdle();
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const origin = host.getBoundingClientRect();
      const box = (node) => {
        const rect = node.getBoundingClientRect();
        return [rect.left - origin.left, rect.top - origin.top, rect.width, rect.height].map((value) => Math.round(value * 10) / 10);
      };
      const pane = host.querySelector('.opf-source-code');
      const code = pane.querySelector('.cm-editor');
      const content = code.querySelector('.cm-content');
      const firstLine = content.querySelector('.cm-line');
      const nodes = [code, ...code.querySelectorAll('*')].filter((node) => node.className && typeof node.className === 'string' && /\bcm-/.test(node.className));
      const styled = nodes.map((node) => {
        const style = getComputedStyle(node);
        return { node: node.className, box: box(node), ...Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name)])) };
      });
      const result = {
        layered: [...document.styleSheets].some((sheet) => [...sheet.cssRules].some((rule) => rule.constructor.name === 'CSSLayerBlockRule')),
        editor: box(code),
        gutters: box(code.querySelector('.cm-gutters')),
        content: box(content),
        contentPadding: getComputedStyle(content).paddingLeft,
        line: box(firstLine),
        linePadding: getComputedStyle(firstLine).paddingLeft,
        lines: content.querySelectorAll('.cm-line').length,
        styled,
      };
      editor.destroy();
      return result;
    }, { d: deck(), layout, properties: PROPERTIES });
  } finally {
    await app.close();
  }
}

for (const layout of ['full', 'source']) {
  const plain = await look(false, layout);
  const layered = await look(true, layout);
  assert.equal(plain.layered, false, 'the plain page has no layer');
  assert.equal(layered.layered, true, 'the layered page loads the layered sheet');
  assert.ok(plain.lines > 5 && plain.styled.length > 20, `${layout}: the pane shows the code (${plain.lines} lines, ${plain.styled.length} CodeMirror elements)`);
  assert.equal(plain.contentPadding, '4px', `${layout}: the source pane's content padding is the package's (16px 16px 16px 4px), not CodeMirror's`);
  assert.ok(plain.gutters[2] >= 30, `${layout}: the line numbers have the package's minimum width`);
  for (const key of ['editor', 'gutters', 'content', 'contentPadding', 'line', 'linePadding', 'lines']) {
    assert.deepEqual(layered[key], plain[key], `${layout}: the ${key} is the same under styles.layered.css as under styles.css`);
  }
  assert.equal(layered.styled.length, plain.styled.length, `${layout}: the same CodeMirror elements`);
  plain.styled.forEach((expected, index) => assert.deepEqual(layered.styled[index], expected, `${layout}: ${expected.node} has the same box and styles under both sheets`));
  mark(`${layout}: the source pane's code has the same geometry and styles under styles.layered.css as under styles.css (${plain.styled.length} elements)`);
}

for (const name of checks) console.log(`ok - ${name}`);
console.log(`layered source pane checks passed (${checks.length})`);
