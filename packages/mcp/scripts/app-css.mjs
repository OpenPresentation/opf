import {transform} from 'esbuild';

// Only serialization whitespace changes. Keep selector/declaration/value
// optimization and identifier mangling off; retain license/preserve comments.
export async function minifyAppCss(css) {
  const {code} = await transform(css, {
    loader: 'css', minifyWhitespace: true, minifySyntax: false,
    minifyIdentifiers: false, charset: 'utf8', legalComments: 'eof',
  });
  return code;
}
