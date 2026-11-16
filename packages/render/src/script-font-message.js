// The one wording of "this script's font package is not installed", for every path that reports it (loadFonts with scripts "auto" or a list,
// ensure, the glyph-fallback chain, demand loading): what to preview and which package at which pinned version, then how to install it.
// The renderer cannot know how its caller was installed (a global CLI, a project's dependency, one npx run), so it names the three forms.

/** `lead` says what the package is for; the result adds the pinned package and the install commands. */
export function scriptFontNotInstalledMessage(lead, packageName, version) {
  const pinned = typeof version === "string" && version ? `${packageName}@${version}` : packageName;
  return `${lead} Install it where the CLI runs, at that version: npm install -g ${pinned} for a global CLI, npm install ${pinned} in the project that depends on the CLI, or add -p ${pinned} to an npx run. Then run the command again to draw this script with a bundled open font.`;
}
