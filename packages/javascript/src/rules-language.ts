import { languageTagProblem } from './language-tag.js';
import type { ValidationContext, ValidationRule } from './rule-context.js';
import { runsOf } from './rule-content.js';
import { rec } from './rule-design.js';
import { languageTagRule } from './validation-rule-info.js';

const isEnUk = (tag: unknown): boolean => typeof tag === 'string' && tag.toLowerCase() === 'en-uk';

// `owned`: the deck's and a slide's `en-UK` is a schema error already; a run's is reported here, as an error, with the `en-GB` fix.
const report = (context: ValidationContext, tag: unknown, path: string, slide?: ValidationContext['slides'][number], owned = false): void => {
	if (typeof tag !== 'string' || (owned && isEnUk(tag))) return;
	const problem = languageTagProblem(tag);
	if (!problem) return;
	context.report(languageTagRule, {
		path,
		slide,
		message: problem.message,
		...(isEnUk(tag) ? { severity: 'error' as const } : {}),
		help: problem.suggestion ? `Write '${problem.suggestion}'.` : 'Write a well-formed BCP 47 tag with an assigned region, such as "en-US", "pt-BR" or "es-419".',
		...(problem.suggestion
			? { fixes: [{ id: 'use-canonical-tag', title: `Use '${problem.suggestion}'`, kind: 'patch' as const, safe: problem.caseOnly, patch: [{ op: 'replace' as const, path, value: problem.suggestion }] }] }
			: {}),
	});
};

export const languageTagRules: ValidationRule[] = [
	{
		info: languageTagRule,
		run(context) {
			const language = context.document.language;
			if (typeof language === 'string') report(context, language, '/language', undefined, true);
			else if (language !== undefined) report(context, rec(language).bcp47, '/language/bcp47', undefined, true);
			for (const slide of context.slides) {
				const language = slide.slide.language;
				if (typeof language === 'string') report(context, language, `${slide.path}/language`, slide, true);
				else if (language !== undefined) report(context, rec(language).bcp47, `${slide.path}/language/bcp47`, slide, true);
			}
			for (const slide of context.slides)
				for (const tv of slide.texts)
					if (typeof tv.value !== 'string') for (const run of runsOf(tv)) report(context, run.style.language, `${run.path}/language`, slide);
		},
	},
];
