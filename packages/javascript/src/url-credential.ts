/**
 * The one test for "this web address carries a credential", shared by every rule that reads an address a deck stores (FR-08's
 * `embed-credentials`; a data source's address reads the same test). Pure: nothing is fetched.
 *
 * An address carries a credential when it holds a user name or password (`https://user:pass@host/`), or a query parameter whose name
 * says it is a secret: a word `key`, `token`, `secret`, `password`, `sig`, `signature` or `auth` (case-insensitive), alone or as a
 * word of the name (`api_key`, `apiKey`, `access-token`, `X-Amz-Signature`, `authorization`, and the compounds `apikey` and `accesstoken`).
 * Matching is by word, not by letters: `monkey`, `design` and `author` are not credentials.
 */

const WORDS = ['key', 'token', 'secret', 'password', 'passwd', 'sig', 'signature', 'auth', 'authorization', 'authentication', 'oauth', 'apikey'];
// Compound words written as one (`apikey`, `accesstoken`, `clientsecret`): a known prefix and a secret word, never a bare ending (`monkey`).
const COMPOUND = /^(?:api|access|secret|private|public|client|auth|refresh|session|bearer|id|app|license)(?:key|token|secret|password|signature)$/;

function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Whether a query parameter name reads as a secret. */
export function isSecretParameterName(name: string): boolean {
  return words(name).some(word => WORDS.includes(word) || COMPOUND.test(word));
}

/**
 * What in an address looks like a credential, as a short phrase for a message (`the user name and password`, `the query parameter
 * "api_key"`), or undefined when nothing does or the text is not an absolute web address.
 */
export function urlCredential(address: unknown): string | undefined {
  if (typeof address !== 'string') return undefined;
  let url: URL;
  try { url = new URL(address); } catch { return undefined; }
  if (url.username !== '' || url.password !== '') return url.password !== '' ? 'the user name and password' : 'the user name';
  for (const name of url.searchParams.keys()) if (isSecretParameterName(name)) return `the query parameter "${name}"`;
  return undefined;
}
