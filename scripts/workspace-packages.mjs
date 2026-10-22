// MR-10: what the workspace checks (check:workspace-graph, check:pins, check:versions) share: the six published packages,
// a reader for the few pnpm-workspace.yaml settings the checks need, and the list of workspace members with their manifests.
//
// A package directory that exists but is not listed in pnpm-workspace.yaml (an imported package before its wire-up, MR-22
// to MR-23) is inert: no check looks at it. Only members count.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** The six published packages (plan section 1): directory under packages/ and npm name. */
export const SIX = [
  { dir: 'javascript', name: '@openpresentation/opf' },
  { dir: 'cli', name: '@openpresentation/cli' },
  { dir: 'render', name: '@openpresentation/opf-render' },
  { dir: 'pptx', name: '@openpresentation/opf-pptx' },
  { dir: 'editor', name: '@openpresentation/opf-editor' },
  { dir: 'gallery', name: '@openpresentation/gallery' },
];
export const CORE = '@openpresentation/opf';
export const GALLERY = '@openpresentation/gallery';

const unquote = (value) => value.trim().replace(/^(['"])(.*)\1$/, '$2');

/**
 * The parts of pnpm-workspace.yaml the checks read: `packages` (a list), `overrides` (a map), and top-level scalars
 * (`linkWorkspacePackages: true`). Not a YAML parser: it reads the flat shape this file has.
 */
export function parseWorkspaceYaml(text) {
  const result = { packages: [], overrides: {}, scalars: {} };
  let section = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').replace(/^#.*$/, '');
    if (!line.trim()) continue;
    const top = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (top) {
      section = top[1];
      if (top[2]) result.scalars[top[1]] = unquote(top[2]);
      continue;
    }
    if (section === 'packages') {
      const item = /^\s+-\s+(.*)$/.exec(line);
      if (item) result.packages.push(unquote(item[1]));
    } else if (section === 'overrides') {
      const entry = /^\s+("[^"]+"|'[^']+'|[^:\s]+):\s*(.+)$/.exec(line);
      if (entry) result.overrides[unquote(entry[1])] = unquote(entry[2]);
    }
  }
  return result;
}

/** Workspace members: `[{dir: 'packages/cli', manifest}]` for every package listed in pnpm-workspace.yaml that has a manifest. */
export function loadWorkspace(root) {
  const file = path.join(root, 'pnpm-workspace.yaml');
  const workspace = parseWorkspaceYaml(existsSync(file) ? readFileSync(file, 'utf8') : '');
  const members = [];
  for (const dir of workspace.packages) {
    if (dir.includes('*')) continue; // a glob is reported by check:workspace-graph; it is not expanded here
    const manifestFile = path.join(root, dir, 'package.json');
    if (existsSync(manifestFile)) members.push({ dir, manifest: JSON.parse(readFileSync(manifestFile, 'utf8')) });
  }
  return { workspace, members };
}

/** The dependency fields pnpm turns into workspace graph edges (peers are not edges). */
export const EDGE_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];
export const DEPENDENCY_FIELDS = [...EDGE_FIELDS, 'peerDependencies'];

/**
 * What a workspace specifier publishes as (`pnpm pack`): `workspace:^` becomes `^<version>`, `workspace:~` `~<version>`,
 * `workspace:*` the exact version. Scripts that read a manifest's ranges in the source tree (the machinery MR-34 retires)
 * use this so a `workspace:` range means what the packed package says. Anything else is returned unchanged.
 */
export function concreteRange(range, version) {
  if (typeof range !== 'string' || !range.startsWith('workspace:')) return range;
  const spec = range.slice('workspace:'.length);
  if (spec === '^' || spec === '~') return `${spec}${version}`;
  if (spec === '*') return version;
  return spec;
}
