import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {test} from 'node:test';
const source=readFileSync(new URL('../src/install.ts',import.meta.url),'utf8');
const start=source.indexOf('export function satisfies('),end=source.indexOf('\n/** Where opf-render',start);
const satisfies=Function(stripTypeScriptTypes(source.slice(start,end).replace('export function','function'))+';return satisfies;')();
for(const [version,range,expected] of [
 ['0.19.0-next.0','^0.19.0',false],['0.19.1-next.0','^0.19.0',false],
 ['0.19.0','^0.19.0',true],['0.19.1','^0.19.0',true],['0.18.2','^0.19.0',false],
 ['0.19.0-next.0','0.19.0-next.0',true],['0.19.0-next.0','0.19.0',false],
 ['0.19.0-next.1','^0.19.0-next.0',true],['0.19.0-next.0','^0.19.0-next.1',false],
 ['0.19.1-next.0','^0.19.0-next.0',false],['0.19.0','^0.19.0-next.0',true],
 ['0.19.0-beta.10','^0.19.0-beta.2',true],['0.19.0-beta','^0.19.0-beta.1',false],
 ['0.19.0-beta.1','^0.19.0-beta',true],['0.19.0-1','^0.19.0-alpha',false],
])test(`${version} satisfies ${range}: ${expected}`,()=>assert.equal(satisfies(version,range),expected));
