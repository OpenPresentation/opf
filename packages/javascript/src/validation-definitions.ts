import { schemaEntries, type SchemaName } from './schemas.js';

interface Definition {
	schemaName: SchemaName;
	pointer: string;
	uri: string;
}

// AJV can compile a referenced subschema as its own root and report '#/type'
// instead of the containing document's definition path. Keep the original
// validator report unchanged; lint can look up the exact parent schema object.
let schemaLocations: WeakMap<object, Definition> | undefined;
const issueLocations = new WeakMap<object, Definition>();

export function rememberValidationDefinition(
	issue: object,
	parentSchema: unknown,
	keyword: string,
) {
	if (!parentSchema || typeof parentSchema !== 'object') return;
	if (!schemaLocations) {
		schemaLocations = new WeakMap();
		for (const entry of schemaEntries) {
			const stack: { value: unknown; pointer: string }[] = [
				{ value: entry.schema, pointer: '' },
			];
			while (stack.length) {
				const current = stack.pop();
				if (!current?.value || typeof current.value !== 'object')
					continue;
				schemaLocations.set(current.value, {
					schemaName: entry.name,
					pointer: current.pointer,
					uri: `${entry.schema.$id}#${current.pointer}`,
				});
				for (const [key, value] of Object.entries(current.value)) {
					const segment = key.replaceAll('~', '~0').replaceAll('/', '~1');
					stack.push({ value, pointer: `${current.pointer}/${segment}` });
				}
			}
		}
	}
	const parent = schemaLocations.get(parentSchema);
	if (!parent) return;
	const suffix = `/${keyword.replaceAll('~', '~0').replaceAll('/', '~1')}`;
	issueLocations.set(issue, {
		...parent,
		pointer: parent.pointer + suffix,
		uri: parent.uri + suffix,
	});
}

export function validationDefinition(issue: object): Definition | undefined {
	return issueLocations.get(issue);
}
