// CE-01: the Worker the workerd tests run. It imports the package root as an application does (so the bundle resolves it with the
// worker conditions), validates the documents of a POST body and answers with the results. Bundled by test/support/workerd.mjs.
import * as opf from '@openpresentation/opf';
import { evaluate } from './edge-evaluate.mjs';

export default {
	async fetch(request) {
		if (request.method !== 'POST') return new Response('ok');
		const documents = await request.json();
		return Response.json(Object.fromEntries(documents.map((document) => [document.id, evaluate(opf, document)])));
	},
};
