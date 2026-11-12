// `#icon-files` outside Node (RR-63): a browser, a Worker or another edge runtime has no installed package to read, so the default
// `load` of `galleryIconSets()` rejects, and a deck's set icons get the `opf/icon-unknown` finding that says to serve the files.
/** Reject: there are no files to read here. */
export async function readIcons(file) {
	throw new Error(
		`The gallery icon files cannot be read in this runtime (${file}): serve the package's dist/icons/ folder and register galleryIconSets(fetchIcons(baseUrl)).`,
	);
}
