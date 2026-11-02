import { resolveChartData } from './chart-data.js';
import type { ValidationRule } from './rule-context.js';
import { slidePayloads } from './rule-content.js';
import { rec } from './rule-design.js';
import { PIE_MAX_SLICES, chartDualAxisRule, chartPieManySlicesRule } from './validation-rule-info.js';

/**
 * LH-105: info findings for charts that Few's principles advise against (Show Me the Numbers; Information Dashboard Design): a combo
 * chart with two value scales, and a pie or doughnut of many slices. They never change what is drawn, and stay info: the author may
 * have a reason. Internal module.
 */

const chartPath = (payloadPath: string, slidePath: string) => `${payloadPath === slidePath ? slidePath : payloadPath}/chart`;

const chartDualAxis: ValidationRule = {
	info: chartDualAxisRule,
	run(context) {
		for (const slide of context.slides)
			for (const payload of slidePayloads(slide.slide, slide.path)) {
				const chart = rec(payload.node.chart);
				if (String(chart.type ?? '').trim().toLowerCase() !== 'combo') continue;
				const resolved = resolveChartData(chart, context.document);
				if (!resolved.ok || !resolved.combo) continue;
				const secondary = resolved.combo.flatMap((entry, index) => (entry.axis === 'secondary' ? [String(resolved.columns[index + 1] ?? '')] : []));
				if (!secondary.length) continue;
				context.report(chartDualAxisRule, {
					path: `${chartPath(payload.path, slide.path)}/secondaryAxis`,
					slide,
					message: `The combo chart plots ${secondary.map((name) => JSON.stringify(name)).join(', ')} on a second value axis, so two scales share one plot.`,
					help: 'Two charts read more truly than one with two scales: show the secondary series in a chart of its own beside this one, or drop `secondaryAxis` when the series share a unit.',
					measured: { secondary: secondary.length },
				});
			}
	},
};

const chartPieManySlices: ValidationRule = {
	info: chartPieManySlicesRule,
	run(context) {
		for (const slide of context.slides)
			for (const payload of slidePayloads(slide.slide, slide.path)) {
				const chart = rec(payload.node.chart);
				const type = String(chart.type ?? '').trim().toLowerCase();
				if (type !== 'pie' && type !== 'doughnut') continue;
				const resolved = resolveChartData(chart, context.document);
				if (!resolved.ok || resolved.rows.length <= PIE_MAX_SLICES) continue;
				context.report(chartPieManySlicesRule, {
					path: chartPath(payload.path, slide.path),
					slide,
					message: `The ${type} chart has ${resolved.rows.length} slices, more than ${PIE_MAX_SLICES}; the small ones are hard to compare and to label.`,
					help: 'Compare the parts with a bar chart (`type: "bar"`, sorted if the order carries no meaning), or group the smallest categories into one "Other" slice.',
					measured: { slices: resolved.rows.length, limit: PIE_MAX_SLICES },
				});
			}
	},
};

/** In report order (content). */
export const chartFindingRules: ValidationRule[] = [chartDualAxis, chartPieManySlices];
