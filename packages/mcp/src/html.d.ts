// The deck view's HTML (app-dist/deck-app.html, built by scripts/build-app.mjs), which tsup inlines as text.
declare module "*.html" {
	const text: string;
	export default text;
}
