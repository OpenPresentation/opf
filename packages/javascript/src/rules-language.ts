import { languageTagProblem } from './language-tag.js';
import type { ValidationContext, ValidationRule } from './rule-context.js';
import { rule } from './rule-context.js';
import { runsOf } from './rule-content.js';
import { rec } from './rule-design.js';

const languageTagRule = rule(
	'language-tag',
	'content',
	'warning',
	'A language tag is malformed, uses an unassigned region or is not in canonical case.',
	'Engines read the deck language and each run\'s `lang` as BCP 47 tags to choose script fonts, text direction, proofing language and the PowerPoint `lang` attribute. A tag such as `en-a`, or a region that does not exist (`en-UK`; the United Kingdom is `GB`), is guessed at or dropped, and a wrong-case tag (`EN-us`) is not what a locale lookup expects.',
	{
		standard: 'BCP 47 (RFC 5646, section 2.1) and the platform locale data (Intl.getCanonicalLocales, Intl.DisplayNames)',
		approximations:
			'Checks the root `language` (a tag string, or the `bcp47` of an inline Language object) and `lang` on the TextRun objects of titles, subtitles, tags, text, lists, tables, quotes, metrics and timelines. A region is assigned when the runtime\'s CLDR data names it (ISO 3166-1 codes and UN M.49 areas such as 419); private-use regions (`AA`, `QM`-`QZ`, `XA`-`XZ`) and `ZZ` are accepted, as are private-use (`x-...`) tags. Only the spelling of a tag is checked, not whether the language subtag is assigned or whether the language suits the text. The schema rejects tags with characters other than letters, digits and hyphens (`en_US` is a schema error, with no suggestion), and `en-UK` as the deck language is already an error of the schema rule, so those are not reported twice.',
	},
);

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
