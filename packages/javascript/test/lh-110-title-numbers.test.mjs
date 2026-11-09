// LH-110 remainder: reference lines from the title also for numbers written as English words ("twenty percent") and for titles in
// German, French, Spanish, Italian, Portuguese and Dutch, with the tested word list of chart-title-numbers.ts.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { composeSlide, englishWordNumber, titleReferenceLanguage, titleReferenceNumbers } from '../dist/composition.js';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const delivery = { type: 'line', data: { columns: ['Month', { name: 'On-time delivery', format: '0.0%' }], rows: months.map((month, i) => [month, [0.934, 0.941, 0.928, 0.952, 0.961, 0.957, 0.944, 0.936, 0.949, 0.968, 0.972, 0.979][i]]) } };
const tickets = { type: 'column', data: { columns: ['Week', 'Tickets'], rows: [['W1', 24], ['W2', 31], ['W3', 27], ['W4', 35]] } };
const linesOf = (title, chart, language) => composeSlide({ title, chart }, { width: 1280, height: 720, ...(language ? { presentation: { language, slides: [] } } : {}) }).items.find((item) => item.field === 'chart').chart.layer?.references?.lines ?? [];
const valuesOf = (text, language) => titleReferenceNumbers(text, language).map((number) => [number.value, number.percent, number.text]);

describe('English number words', () => {
	test('values', () => {
		for (const [words, value] of [['zero', 0], ['six', 6], ['twelve', 12], ['twenty', 20], ['ninety-two', 92], ['ninety two', 92], ['one hundred', 100], ['a', undefined], ['hundred', 100], ['one hundred and five', 105], ['two thousand', 2000], ['two thousand five hundred', 2500], ['three million', 3000000]]) {
			assert.equal(englishWordNumber(words), value, words);
		}
		for (const words of ['five six', 'two twenty', 'twenty ninety', 'twenty twelve']) assert.equal(englishWordNumber(words), undefined, words);
	});
	test('only after a comparison word, labeled in digits', () => {
		assert.deepEqual(valuesOf('Delivery stayed above ninety-two percent'), [[92, true, '92%']]);
		assert.deepEqual(valuesOf('Tickets stayed under thirty a week'), [[30, false, '30']]);
		assert.deepEqual(valuesOf('Six teams beat the target of twenty-five'), [[25, false, '25']], 'a number word that no comparison names is not a reference');
		assert.deepEqual(valuesOf('Someone said twenty percent'), []);
		assert.deepEqual(valuesOf('Delivery stayed above 92%'), [[92, true, '92%']], 'digits as before');
	});
	test('draws the line', () => {
		const [line] = linesOf('On-time delivery stayed above ninety-two percent all year', delivery);
		assert.equal(line.value, 0.92);
		assert.equal(line.text, '92%');
		assert.equal(linesOf('Tickets stayed under thirty a week', tickets)[0]?.value, 30);
	});
});

describe('European titles', () => {
	const cases = [
		['de', 'Die Pünktlichkeit lag das ganze Jahr über 92 %', [92, true, '92 %']],
		['de', 'Mindestens 92,5 Prozent pünktlich', [92.5, true, '92,5 Prozent']],
		['de', 'Tickets blieben unter dem Zielwert von 30', [30, false, '30']],
		['fr', 'La ponctualité est restée au-dessus de 92 %', [92, true, '92 %']],
		['fr', 'Moins de 30 tickets par semaine', [30, false, '30']],
		['fr', "L'équipe a dépassé l'objectif de 30", [30, false, '30']],
		['es', 'La puntualidad se mantuvo por encima del 92 %', [92, true, '92 %']],
		['es', 'Superó la meta de 30 tickets', [30, false, '30']],
		['it', 'La puntualità è rimasta sopra il 92%', [92, true, '92%']],
		['it', 'Meno di 30 ticket a settimana', [30, false, '30']],
		['pt', 'A pontualidade ficou acima de 92 %', [92, true, '92 %']],
		['pt', 'Superou a meta de 30 chamados', [30, false, '30']],
		['nl', 'De stiptheid bleef boven 92 %', [92, true, '92 %']],
		['nl', 'Minder dan 30 tickets per week', [30, false, '30']],
	];
	for (const [language, title, expected] of cases) {
		test(`${language}: ${title}`, () => assert.deepEqual(valuesOf(title, language), [expected]));
	}
	test('a number without a comparison word is not a reference', () => {
		assert.deepEqual(valuesOf('Die Pünktlichkeit lag bei 92 %', 'de'), []);
		assert.deepEqual(valuesOf('La ponctualité a atteint son record en 2024', 'fr'), []);
		assert.deepEqual(valuesOf('92 % de ponctualité', 'fr'), []);
	});
	test('a decimal comma and thousands separators', () => {
		assert.deepEqual(valuesOf('über 1.000 Tickets', 'de'), [[1000, false, '1.000']]);
		assert.deepEqual(valuesOf('plus de 1 000 tickets', 'fr'), [[1000, false, '1 000']]);
		assert.deepEqual(valuesOf('más de 2,5 millones', 'es'), [[2.5, false, '2,5']]);
	});
	test('languages: the six European ones and English; others are not read', () => {
		for (const language of ['en', 'en-GB', 'de', 'de-CH', 'fr', 'es', 'it', 'pt-BR', 'nl']) assert.ok(titleReferenceLanguage(language), language);
		for (const language of ['ja', 'ar', 'pl', 'zh-Hans']) assert.equal(titleReferenceLanguage(language), undefined, language);
		assert.deepEqual(valuesOf('above 92%', 'ja'), []);
		assert.deepEqual(valuesOf('über ninety percent', 'de'), [], 'English number words only in English');
	});
	test('German and French titles draw the line', () => {
		assert.equal(linesOf('Die Pünktlichkeit lag das ganze Jahr über 92 %', delivery, 'de')[0]?.value, 0.92);
		const [line] = linesOf('La ponctualité est restée au-dessus de 92 %', delivery, 'fr');
		assert.equal(line?.value, 0.92);
		assert.equal(line.text, '92 %');
	});
});
