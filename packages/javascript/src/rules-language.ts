import { languageTagProblem } from './language-tag.js';
import type { ValidationContext, ValidationRule } from './rule-context.js';
import { runsOf } from './rule-content.js';
import { rec } from './rule-design.js';
import { languageTagRule } from './validation-rule-info.js';

const report = (context: ValidationContext, tag: unknown, path: string, slide?: ValidationContext['slides'][number]): void => {
	if (typeof tag !== 'string') return;
	const problem = languageTagProblem(tag);
	if (!problem) return;
	context.report(languageTagRule, {
		path,
		slide,
		message: problem.message,
		help: problem.suggestion ? `Write '${problem.suggestion}'.` : 'Write a well-formed BCP 47 tag with an assigned region, such as "en-US", "pt-BR" or "es-419".',
		...(problem.suggestion
			? { fixes: [{ id: 'use-canonical-tag', title: `Use '${problem.suggestion}'`, kind: 'patch' as const, safe: problem.caseOnly, patch: [{ op: 'replace' as const, path, value: problem.suggestion }] }] }
			: {}),
	});
};

const isEnUk = (tag: unknown): boolean => typeof tag === 'string' && tag.toLowerCase() === 'en-uk';

export const languageTagRules: ValidationRule[] = [
	{
		info: languageTagRule,
		run(context) {
			const language = context.document.language;
			// `en-UK` as the deck language is already a schema error with its own replacement.
			if (typeof language === 'string') {
				if (!isEnUk(language)) report(context, language, '/language');
			} else if (language !== undefined && !isEnUk(rec(language).bcp47)) report(context, rec(language).bcp47, '/language/bcp47');
			for (const slide of context.slides)
				for (const tv of slide.texts)
					if (typeof tv.value !== 'string') for (const run of runsOf(tv)) report(context, run.style.lang, `${run.path}/lang`, slide);
		},
	},
];
