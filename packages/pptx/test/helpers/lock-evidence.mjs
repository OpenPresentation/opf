// MR-23c: the lockfile evidence the native and comparison tests record next to the runtime file hashes.
// In the monorepo the package has no lockfile of its own: the evidence is the sha256 of the package set the repository's
// pnpm-lock.yaml installs for this package (scripts/pnpm-lock.mjs), the same value for the same installed set on every
// OS. An isolated npm consumer (the packed-install native run copies the harness into one) keeps its own package-lock.json,
// hashed as bytes. Returns [key, sha256]; the key names the kind, so evidence from the two never compares as equal.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockEvidenceSha256, readRepositoryLock } from '../../scripts/pnpm-lock.mjs';

export function lockEvidence(root = new URL('../../', import.meta.url)) {
  const directory = root instanceof URL ? fileURLToPath(root) : root;
  const consumerLock = path.join(directory, 'package-lock.json');
  if (existsSync(consumerLock)) return ['package-lock.json', createHash('sha256').update(readFileSync(consumerLock)).digest('hex')];
  const { text, importerDir } = readRepositoryLock(directory);
  return [`pnpm-lock.yaml#${importerDir}`, lockEvidenceSha256(text, importerDir)];
}
