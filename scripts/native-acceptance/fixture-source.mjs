import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {primaryDecks} from './fixtures.mjs';

const fixture = name => new URL(`./fixtures/${name}`, import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const CURRENT_CHART_FIXTURE_PATH='packages/pptx/test/fixtures/chartex-fallback-main.json';
export const HISTORICAL_CHART_FIXTURE_PATH='scripts/native-acceptance/fixtures/chartex-fallback-main.json';
export const CHART_FIXTURE_PATHS=Object.freeze([CURRENT_CHART_FIXTURE_PATH,HISTORICAL_CHART_FIXTURE_PATH]);

// Preparation follows the reviewed package archive authority. The old native
// witness remains immutable evidence; it is never an alternate accepted hash.
export async function loadChartFixtureSource(){
  const records=await Promise.all(CHART_FIXTURE_PATHS.map(async path=>{
    const bytes=await readFile(new URL('../../'+path,import.meta.url));
    return {path,sha256:sha256(bytes),fixture:JSON.parse(bytes)};
  }));
  const [current,historicalNative]=records;
  assert.deepEqual(current.fixture.decks,historicalNative.fixture.decks,'current and historical chart inputs must remain identical');
  assert.deepEqual(Object.keys(current.fixture.decks),Object.keys(current.fixture.entries),'every chart has a reviewed current archive entry');
  assert.equal(Object.keys(current.fixture.decks).length,9,'retain all nine chart fixtures');
  const identity=record=>({path:record.path,sha256:record.sha256,source:record.fixture.source});
  return {chartFixture:current.fixture,chartBaselines:{current:{...identity(current),scope:'output-preparation'},historicalNative:{...identity(historicalNative),scope:'historical-native-witness'},nativeAcceptance:false,registryAcceptance:false}};
}

export const PRIMARY_CASE_NAMES = Object.freeze([
  'layout-title-auto','layout-media-regions','layout-empty-custom','table-save',
  'furniture-inherited','furniture-flags','list-description-native-edit','list-description-native-save','layout-bleed-card','picture-control','furniture-layouts',
  'chart-treemap-category','chart-histogram-single','chart-histogram-category',
  'chart-pareto-multi','chart-box-multi','chart-waterfall-single',
  'chart-funnel-category','chart-world-category','chart-all-seven',
  'feature-catalog-timeline','feature-dense-events','feature-custom-roadmap',
  'feature-long-labels','feature-metrics','feature-quote','feature-list','feature-table',
]);

export async function loadFixtureSource() {
  const imageBytes=await readFile(fixture('wide.png'));
  const {chartFixture,chartBaselines}=await loadChartFixtureSource();
  const featureManifestBytes=await readFile(fixture('feature-inputs.json'));
  const featureManifest=JSON.parse(featureManifestBytes);
  assert.deepEqual(Object.keys(chartFixture.decks),Object.keys(chartFixture.entries),'every chart has a reviewed archive entry');
  assert.equal(Object.keys(chartFixture.decks).length,9,'retain all nine chart fixtures');
  assert.equal(Object.keys(featureManifest).length,8,'retain all eight measured feature inputs');
  const image={src:`data:image/png;base64,${imageBytes.toString('base64')}`,alt:'Packet local picture'};
  const base={design:{fontScheme:'roboto',dimensions:{widthInches:13.333333,heightInches:7.5}}};
  const decks=primaryDecks(image,chartFixture,base);
  for(const [name,record] of Object.entries(featureManifest)) {
    assert.match(name,/^feature-[a-z0-9-]+$/);
    const bytes=await readFile(fixture(`features/${name}.opf.json`));
    assert.equal(sha256(bytes),record.candidateSHA256,`feature source changed: ${name}`);
    assert.ok(!Object.hasOwn(decks,name),`duplicate source case: ${name}`);
    decks[name]=JSON.parse(bytes);
  }
  assert.deepEqual(Object.keys(decks),PRIMARY_CASE_NAMES,'primary case set or order changed');
  return {decks,base,chartFixture,chartBaselines,featureManifest,sourceFiles:[
    {path:'fixtures/wide.png',sha256:sha256(imageBytes)},
    ...CHART_FIXTURE_PATHS.map(path=>({path,sha256:Object.values(chartBaselines).find(record=>record?.path===path).sha256})),
    {path:'fixtures/feature-inputs.json',sha256:sha256(featureManifestBytes)},
  ]};
}

export async function actionPlanFor(name) {
  assert.ok(PRIMARY_CASE_NAMES.includes(name),`unknown case: ${name}`);
  if(!['layout-title-auto','furniture-inherited','list-description-native-edit'].includes(name))return [];
  const actions=JSON.parse(await readFile(fixture(`actions/${name}.json`)));
  assert.ok(Array.isArray(actions)&&actions.length>0&&actions.length<=20,`invalid action count: ${name}`);
  return actions;
}
