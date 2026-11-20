import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalCssomRules as canonical} from './helpers/app-cssom.mjs';

const rule = (name, value, priority = '') => [{type: 1, selector: '.scope', declarations: [[name, value, priority]]}];
test('CSSOM comparison admits only reviewed optional comma whitespace', () => {
  const same = (name, a, b) => assert.deepEqual(canonical(rule(name, a)), canonical(rule(name, b)));
  same('transition', 'color var(--t), \n opacity var(--t)', 'color var(--t),opacity var(--t)');
  same('box-shadow', '0 0 1px var(--x),  0 0 2px var(--y)', '0 0 1px var(--x),0 0 2px var(--y)');
  for (const fn of ['max', 'min', 'minmax', 'color-mix', 'linear-gradient']) same('width', `${fn}(var(--x),  40px)`, `${fn}(var(--x),40px)`);
});

test('CSSOM comparison retains value, cascade, name, order and priority differences', () => {
  const base = rule('transition', 'color var(--t), opacity var(--t)');
  for (const changed of [rule('transition', 'color var(--other), opacity var(--t)'), rule('transition', 'opacity var(--t), color var(--t)'), rule('transition', base[0].declarations[0][1], 'important'), rule('animation', base[0].declarations[0][1])]) assert.notDeepEqual(canonical(base), canonical(changed));
  const shadow = rule('box-shadow', '0 0 1px var(--x),0 0 2px var(--y)');
  assert.notDeepEqual(canonical(shadow), canonical(rule('box-shadow', '0 0 3px var(--x),0 0 2px var(--y)')));
  assert.notDeepEqual(canonical(shadow), canonical(rule('box-shadow', '0 0 2px var(--y),0 0 1px var(--x)')));
  const a = {...rule('color', 'red')[0], declarations: [['color', 'red', ''], ['background', 'blue', '']]};
  assert.notDeepEqual(canonical([a]), canonical([{...a, declarations: [...a.declarations].reverse()}]));
  const b = {...rule('color', 'blue')[0], selector: '.other'};
  assert.notDeepEqual(canonical([a, b]), canonical([b, a]));
  assert.notDeepEqual(canonical([{type: 4, header: '@media (width > 1px)', rules: [a]}]), canonical([{type: 4, header: '@media (width > 2px)', rules: [a]}]));
});

test('custom, quoted, escaped, comment, URL, var fallback, unknown and required calc spacing stays exact', () => {
  for (const [name, a, b] of [
    ['--literal', 'one,  two', 'one,two'], ['content', '"one,  two"', '"one,two"'],
    ['transition', 'foo\\,  bar', 'foo\\,bar'], ['transition', 'foo/*,  x*/, bar', 'foo/*,x*/,bar'],
    ['background', 'url(data:text/plain,a, b)', 'url(data:text/plain,a,b)'],
    ['width', 'var(--x,  40px)', 'var(--x,40px)'], ['width', 'future(var(--x), 40px)', 'future(var(--x),40px)'],
    ['width', 'future(max(1px, 2px))', 'future(max(1px,2px))'],
    ['margin', 'calc(1px + 2px)', 'calc(1px+2px)'], ['transition', 'color  var(--t),opacity 1s', 'color var(--t),opacity 1s'],
  ]) assert.notDeepEqual(canonical(rule(name, a)), canonical(rule(name, b)), `${name}: ${a}`);
});
