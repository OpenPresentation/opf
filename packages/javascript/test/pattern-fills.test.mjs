import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PATTERN_PRESETS,PATTERN_PRESET_ALIASES,PATTERN_TILE_SIZE,patternBitmap,patternRuns,resolvePatternPreset} from '../dist/index.js';

const density=preset=>patternBitmap(preset).reduce((sum,row)=>sum+row.toString(2).replace(/0/g,'').length,0);
const mirror=row=>parseInt(row.toString(2).padStart(8,'0').split('').reverse().join(''),2);
const ECMA_ST_PRESET_PATTERN_VAL=['pct5','pct10','pct20','pct25','pct30','pct40','pct50','pct60','pct70','pct75','pct80','pct90','horz','vert','ltHorz','ltVert','dkHorz','dkVert','narHorz','narVert','dashHorz','dashVert','cross','dnDiag','upDiag','ltDnDiag','ltUpDiag','dkDnDiag','dkUpDiag','wdDnDiag','wdUpDiag','dashDnDiag','dashUpDiag','diagCross','smCheck','lgCheck','smGrid','lgGrid','dotGrid','smConfetti','lgConfetti','horzBrick','diagBrick','solidDmnd','openDmnd','dotDmnd','plaid','sphere','weave','divot','shingle','wave','trellis','zigZag'];

test('all 54 ECMA-376 ST_PresetPatternVal presets have an 8x8 bitmap',()=>{
  assert.equal(PATTERN_TILE_SIZE,8);
  assert.deepEqual([...PATTERN_PRESETS],ECMA_ST_PRESET_PATTERN_VAL);
  assert.equal(new Set(PATTERN_PRESETS).size,54);
  for(const preset of PATTERN_PRESETS) {
    const bitmap=patternBitmap(preset);
    assert.equal(bitmap.length,8,preset);
    assert.ok(bitmap.every(row=>Number.isInteger(row)&&row>=0&&row<=255),preset);
    assert.ok(density(preset)>0&&density(preset)<64,`${preset} is neither empty nor solid`);
    assert.equal(resolvePatternPreset(preset),preset);
  }
});

test('percent tints grow monotonically from 5% to 90% and pct50 is a one-pixel checkerboard',()=>{
  const tints=['pct5','pct10','pct20','pct25','pct30','pct40','pct50','pct60','pct70','pct75','pct80','pct90'].map(density);
  for(let index=1;index<tints.length;index++)assert.ok(tints[index]>tints[index-1],`tint ${index}`);
  assert.deepEqual(patternBitmap('pct50').map(row=>row.toString(2).padStart(8,'0')),['10101010','01010101','10101010','01010101','10101010','01010101','10101010','01010101']);
  // Measured from desktop PowerPoint (Office 365, Windows, 2026-10-01): pixels set per tile.
  assert.deepEqual(['pct5','pct10','pct20','pct25','pct30','pct40','pct50','pct60','pct70','pct75','pct80','pct90'].map(density),[2,4,8,16,24,30,32,40,48,56,60,62]);
});

test('line, dark and wide presets differ by thickness; grids and checks by scale',()=>{
  assert.ok(density('ltHorz')<density('dkHorz')&&density('dkHorz')<density('narHorz')+1);
  assert.ok(density('ltDnDiag')<density('dkDnDiag')&&density('dnDiag')<density('wdDnDiag'));
  assert.deepEqual([...patternBitmap('upDiag')],[...patternBitmap('dnDiag')].map(mirror));
  assert.ok(density('smGrid')>density('lgGrid'));
  assert.equal(density('smCheck'),32);assert.equal(density('lgCheck'),32);
  assert.notDeepEqual([...patternBitmap('smCheck')],[...patternBitmap('lgCheck')]);
});

test('no two presets share a tile except the documented GDI+ twin (cross and lgGrid)',()=>{
  const seen=new Map();
  for(const preset of PATTERN_PRESETS) {
    const key=patternBitmap(preset).join(',');
    if(seen.has(key))assert.deepEqual([seen.get(key),preset],['cross','lgGrid']);
    seen.set(key,preset);
  }
});

test('tiles are the ones measured from desktop PowerPoint, anchored at the slide top-left',()=>{
  const ascii=preset=>patternBitmap(preset).map(row=>row.toString(2).padStart(8,'0').replace(/0/g,'.').replace(/1/g,'#')).join('/');
  assert.equal(ascii('pct5'),'#......./......../......../......../....#.../......../......../........');
  assert.equal(ascii('wdUpDiag'),'#.....##/.....###/....###./...###../..###.../.###..../###...../##.....#');
  assert.equal(ascii('narVert'),'.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#/.#.#.#.#');
  assert.equal(ascii('zigZag'),'#......#/.#....#./..#..#../...##.../#......#/.#....#./..#..#../...##...');
});

test('the legacy diagStripe id draws and exports as wdUpDiag; unknown ids have no bitmap',()=>{
  assert.deepEqual({...PATTERN_PRESET_ALIASES},{diagStripe:'wdUpDiag'});
  assert.equal(resolvePatternPreset('diagStripe'),'wdUpDiag');
  assert.deepEqual(patternBitmap('diagStripe'),patternBitmap('wdUpDiag'));
  for(const unknown of [undefined,null,'',42,'PCT5','dots','constructor','__proto__'])assert.equal(patternBitmap(unknown),undefined);
});

test('runs are the set pixels of each row, merged left to right',()=>{
  for(const preset of PATTERN_PRESETS) {
    const rebuilt=Array(8).fill(0);
    for(const {x,y,width} of patternRuns(preset))for(let dx=0;dx<width;dx++)rebuilt[y]|=0x80>>(x+dx);
    assert.deepEqual(rebuilt,[...patternBitmap(preset)],preset);
  }
  assert.deepEqual(patternRuns('horz'),[{x:0,y:0,width:8}]);
  assert.equal(patternRuns('nope'),undefined);
});
