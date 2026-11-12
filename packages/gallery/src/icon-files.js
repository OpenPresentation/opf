// `#icon-files` outside Node (RR-63): a browser, a Worker or another edge runtime has no installed package to read, so the default
// `load` of `galleryIconSets()` rejects, and a deck's set icons get the `opf/icon-unknown` finding that says to serve the files.

/** This runtime reads no installed files (`installedIconSets()` registers nothing). */
export const INSTALLED_ICON_FILES = false;

/** Reject: there are no files to read here (the same message for every file, so it is said once). */
export async function readIcons() {
	throw new Error("The gallery icon files cannot be read in this runtime: serve @openpresentation/gallery's dist/icons/ folder and register galleryIconSets(fetchIcons(baseUrl)).");
}
