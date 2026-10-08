/**
 * Checks a BCP 47 language tag against the platform's locale data (`Intl`). Pure and synchronous: it reads no catalog
 * and fetches nothing. Used by `opf/language-tag`.
 *
 * Internal module: not part of the package exports.
 */

export interface LanguageTagProblem {
	message: string;
	/** The tag to write instead, when one is known. */
	suggestion?: string;
	/** True when the suggestion changes the tag's letter case only, never what it names. */
	caseOnly: boolean;
}

/** Well-known wrong regions, by the code people reach for. `UK` is not an ISO 3166-1 code: the United Kingdom is `GB`. */
const REGION_ALIASES: Readonly<Record<string, string>> = { UK: 'GB' };

/** Private-use and special regions that carry no assignment by design (ISO 3166-1 user-assigned codes, `ZZ` unknown). */
const privateRegion = /^(?:AA|Q[M-Z]|X[A-Z]|ZZ)$/;

let regionNames: Intl.DisplayNames | undefined;
const assignedRegion = (region: string): boolean => {
	if (privateRegion.test(region)) return true;
	regionNames ??= new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });
	// An unknown region comes back as the code itself; an assigned one (and a UN M.49 area such as 419) as its name.
	try {
		return regionNames.of(region) !== region;
	} catch {
		return false;
	}
};

const canonical = (tag: string): string | undefined => {
	try {
		return Intl.getCanonicalLocales(tag)[0];
	} catch {
		return undefined;
	}
};

/** The region subtag as written (two letters or three digits after the language, extlang and script), upper-cased, with its index. */
function regionSubtag(tag: string): { region: string; index: number } | undefined {
	const subtags = tag.split('-');
	for (let index = 1; index < subtags.length; index++) {
		const subtag = subtags[index] as string;
		if (/^(?:[a-z]{2}|\d{3})$/i.test(subtag)) return { region: subtag.toUpperCase(), index };
		// Script (four letters) and extlang (three letters) may precede the region; anything else ends the search.
		if (!/^[a-z]{3,4}$/i.test(subtag)) return undefined;
	}
	return undefined;
}

/**
 * What is wrong with a language tag, or undefined when it is a well-formed tag in canonical form whose region (if any)
 * is assigned. Private-use (`x-...`) and grandfathered `i-...` tags are left alone: they name nothing `Intl` knows.
 */
export function languageTagProblem(tag: string): LanguageTagProblem | undefined {
	if (/^[ix]-/i.test(tag)) return undefined;
	const parsed = canonical(tag);
	if (parsed === undefined) return { message: `'${tag}' is not a well-formed BCP 47 language tag (subtags are letters and digits joined by hyphens, such as 'en-US' or 'zh-Hans').`, caseOnly: false };
	const found = regionSubtag(tag);
	if (found) {
		const alias = REGION_ALIASES[found.region];
		if (alias || !assignedRegion(found.region)) {
			const subtags = tag.split('-');
			subtags[found.index] = alias ?? found.region;
			const suggestion = alias ? canonical(subtags.join('-')) : undefined;
			return {
				message: `'${tag}' names the region '${found.region}', which is not an assigned region${suggestion ? `; '${suggestion}' is the tag for ${new Intl.DisplayNames(['en'], { type: 'region' }).of(alias as string)}` : ''}.`,
				...(suggestion ? { suggestion } : {}),
				caseOnly: false,
			};
		}
	}
	if (parsed === tag) return undefined;
	if (parsed.toLowerCase() === tag.toLowerCase())
		return { message: `'${tag}' is not in canonical case; the canonical form is '${parsed}' (language lower case, script title case, region upper case).`, suggestion: parsed, caseOnly: true };
	// A deprecated region (`BU` for `MM`) is replaced by the locale data. A deprecated language subtag (`iw`) or a macrolanguage the data
	// folds (`kmr` into `ku`) is a legitimate way to write the tag and is left alone.
	const replacement = found && regionSubtag(parsed)?.region;
	if (found && replacement && replacement !== found.region) {
		const subtags = tag.split('-');
		subtags[found.index] = replacement;
		return { message: `'${tag}' names the region '${found.region}', which is deprecated; use '${replacement}'.`, suggestion: subtags.join('-'), caseOnly: false };
	}
	return undefined;
}
