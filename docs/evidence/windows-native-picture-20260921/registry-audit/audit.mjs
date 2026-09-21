import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const consumerRoot = process.cwd();
const artifactRoot = path.resolve(consumerRoot, '..');
const auditDir = path.join(artifactRoot, 'registry-audit');
const auditScriptPath = path.join(auditDir, 'audit.mjs');
const sourceRoot = path.join(artifactRoot, 'sources');
const nodeRoot = path.join(artifactRoot, 'toolchain', 'node_modules', 'node');
const expectedNodeExe = path.join(nodeRoot, 'bin', 'node.exe');
const fiveNames = [
  '@openpresentation/opf',
  '@openpresentation/opf-render',
  '@openpresentation/opf-editor',
  '@openpresentation/opf-pptx',
  '@openpresentation/cli',
];
const fontPrefix = '@expo-google-fonts/';
const failures = [];
const checks = [];
const mark = (id, ok, detail) => {
  checks.push({ id, status: ok ? 'pass' : 'fail', detail });
  if (!ok) failures.push({ id, detail });
};
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha256Bytes = (b) => crypto.createHash('sha256').update(b).digest('hex');
const sha256File = (p) => sha256Bytes(fs.readFileSync(p));
const rel = (p, base) => path.relative(base, p).split(path.sep).join('/');
const within = (candidate, base) => {
  const r = path.relative(base, candidate);
  return r === '' || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r));
};
const normCmp = (p) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
const pkgFolder = (root, name) => path.join(root, 'node_modules', ...name.split('/'));
const fileExists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const dirExists = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const sourceHeadFromGitMetadata = (root) => {
  const dotGitPath = path.join(root, '.git');
  let gitDir;
  if (fs.statSync(dotGitPath).isDirectory()) gitDir = dotGitPath;
  else {
    const match = fs.readFileSync(dotGitPath, 'utf8').trim().match(/^gitdir:\s*(.+)$/i);
    if (!match) throw new Error(`Unrecognized .git file in ${root}`);
    gitDir = path.resolve(root, match[1]);
  }
  const headText = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
  if (!headText.startsWith('ref: ')) return headText;
  const refName = headText.slice(5);
  const commonDirFile = path.join(gitDir, 'commondir');
  const commonDir = fileExists(commonDirFile)
    ? path.resolve(gitDir, fs.readFileSync(commonDirFile, 'utf8').trim())
    : gitDir;
  for (const base of [gitDir, commonDir]) {
    const refPath = path.join(base, ...refName.split('/'));
    if (fileExists(refPath)) return fs.readFileSync(refPath, 'utf8').trim();
  }
  for (const base of [commonDir, gitDir]) {
    const packedPath = path.join(base, 'packed-refs');
    if (!fileExists(packedPath)) continue;
    const line = fs.readFileSync(packedPath, 'utf8').split(/\r?\n/).find((x) => x.endsWith(` ${refName}`));
    if (line) return line.split(' ')[0];
  }
  throw new Error(`Could not resolve ${refName} in git metadata for ${root}`);
};

const report = {
  schemaVersion: 1,
  auditStartedUtc: new Date().toISOString(),
  scope: {
    artifactRoot,
    consumerRoot,
    sourceRoot,
    activities: [
      'Read-only inspection of package/source/runtime pins, installed registry package versions, npm lock metadata, Node public export resolution and installed font package inventory.',
      'No Office calls, user-interface automation, network access, source edits, installs, commits or pull requests were performed by this audit script.'
    ],
    nativeAcceptance: 'Not evaluated; this report does not imply native Office acceptance.'
  },
  runtime: {},
  inputHashes: {},
  sources: [],
  packageVersions: [],
  publicExports: [],
  openPresentationCopies: [],
  fonts: [],
  checks,
  failures,
};

const expectedExeReal = fs.realpathSync.native(expectedNodeExe);
report.runtime = {
  version: process.version,
  executable: process.execPath,
  expectedExecutable: expectedNodeExe,
  expectedExecutableRealpath: expectedExeReal,
  executableSha256: sha256File(expectedNodeExe),
};
mark('node-version', process.version === 'v24.21.0', `Observed ${process.version}; required v24.21.0.`);
mark('node-executable', normCmp(process.execPath) === normCmp(expectedExeReal), `Observed ${process.execPath}; expected ${expectedExeReal}.`);

const planPath = path.join(sourceRoot, 'opf', 'release-plan.json');
const metadataPath = path.join(artifactRoot, 'registry-metadata.json');
const pinsPath = path.join(artifactRoot, 'source-pins.json');
const inventoryPath = path.join(artifactRoot, 'repository-inventory-after-fetch.json');
const installedPath = path.join(artifactRoot, 'registry-installed.json');
const consumerPackagePath = path.join(consumerRoot, 'package.json');
const lockPath = path.join(consumerRoot, 'package-lock.json');
const plan = readJson(planPath);
const registryMetadata = readJson(metadataPath);
const sourcePins = readJson(pinsPath);
const sourceInventory = readJson(inventoryPath);
const installedReceipt = readJson(installedPath);
const consumerPackage = readJson(consumerPackagePath);
const lock = readJson(lockPath);
const planByName = new Map(plan.packages.map((x) => [x.name, x]));
const metadataByName = new Map(registryMetadata.map((x) => [x.name, x]));
const pinByName = new Map(sourcePins.map((x) => [x.name, x]));
const installedByName = new Map(Object.entries(installedReceipt.dependencies || {}));
const rootDeps = consumerPackage.dependencies || {};
const lockRootDeps = lock.packages?.['']?.dependencies || {};
report.inputHashes = {
  releasePlanSha256: sha256File(planPath),
  registryMetadataSha256: sha256File(metadataPath),
  sourcePinsSha256: sha256File(pinsPath),
  repositoryInventoryAfterFetchSha256: sha256File(inventoryPath),
  registryInstalledReceiptSha256: sha256File(installedPath),
  consumerPackageSha256: sha256File(consumerPackagePath),
  packageLockSha256: sha256File(lockPath),
  packageLockPath: lockPath,
};
mark('lockfile-format', lock.lockfileVersion === 3, `lockfileVersion=${lock.lockfileVersion}; expected 3.`);

for (const name of fiveNames) {
  const planEntry = planByName.get(name);
  const meta = metadataByName.get(name);
  const consumerDeclared = rootDeps[name];
  const lockRootDeclared = lockRootDeps[name];
  const lockEntry = lock.packages?.[`node_modules/${name}`];
  const installedPathForPkg = pkgFolder(consumerRoot, name);
  const installedManifestPath = path.join(installedPathForPkg, 'package.json');
  const installedManifest = readJson(installedManifestPath);
  const receipt = installedByName.get(name);
  const expectedVersion = planEntry?.version;
  const metadataVersion = meta?.metadata?.version;
  const metadataPlanVersion = meta?.plannedVersion;
  const lockResolvedMatch = lockEntry?.resolved === meta?.metadata?.dist?.tarball;
  const lockIntegrityMatch = lockEntry?.integrity === meta?.metadata?.dist?.integrity;
  const pkg = {
    name,
    version: installedManifest.version,
    expectedSourceReleasePlanVersion: expectedVersion,
    retainedMetadataPlannedVersion: metadataPlanVersion,
    retainedMetadataPublishedVersion: metadataVersion,
    consumerDependencyRange: consumerDeclared,
    lockRootDependencyRange: lockRootDeclared,
    lockfileVersion: lockEntry?.version,
    lockfileResolved: lockEntry?.resolved,
    metadataTarball: meta?.metadata?.dist?.tarball,
    lockfileIntegrity: lockEntry?.integrity,
    metadataIntegrity: meta?.metadata?.dist?.integrity,
    lockResolvedMatchesMetadata: lockResolvedMatch,
    lockIntegrityMatchesMetadata: lockIntegrityMatch,
    registryInstallReceipt: receipt || null,
    installedPackageRoot: installedPathForPkg,
    installedPackageRealpath: fs.realpathSync.native(installedPathForPkg),
  };
  report.packageVersions.push(pkg);
  const sameVersions = [expectedVersion, metadataPlanVersion, metadataVersion, consumerDeclared, lockRootDeclared, lockEntry?.version, installedManifest.version].every((v) => v === expectedVersion);
  mark(`package-version:${name}`, sameVersions, `source plan=${expectedVersion}; metadata planned/published=${metadataPlanVersion}/${metadataVersion}; package.json=${consumerDeclared}; lock root=${lockRootDeclared}; lock entry=${lockEntry?.version}; installed=${installedManifest.version}.`);
  mark(`registry-lock:${name}`, Boolean(lockEntry?.resolved && lockEntry?.integrity && lockResolvedMatch && lockIntegrityMatch), `lock resolved/integrity must equal metadata dist tarball/integrity; resolvedMatch=${lockResolvedMatch}; integrityMatch=${lockIntegrityMatch}.`);
  mark(`install-receipt:${name}`, Boolean(receipt && receipt.version === expectedVersion && receipt.resolved === meta?.metadata?.dist?.tarball), `Retained install receipt ${JSON.stringify(receipt || null)}.`);
}

const sourceToPlanKeys = {
  opf: ['opf', 'cli'],
  'opf-render': ['opf-render'],
  'opf-pptx': ['opf-pptx'],
  'opf-editor': ['opf-editor'],
};
const walkPackageManifests = (root) => {
  const found = [];
  const visit = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist' || ent.name === 'build') continue;
      const child = path.join(d, ent.name);
      const pkgPath = path.join(child, 'package.json');
      if (fileExists(pkgPath)) {
        try {
          const p = readJson(pkgPath);
          if (fiveNames.includes(p.name)) found.push({ name: p.name, version: p.version, path: pkgPath });
        } catch { }
      }
      visit(child);
    }
  };
  const rootPkg = path.join(root, 'package.json');
  if (fileExists(rootPkg)) {
    try { const p = readJson(rootPkg); if (fiveNames.includes(p.name)) found.push({ name: p.name, version: p.version, path: rootPkg }); } catch { }
  }
  visit(root);
  return found;
};
for (const pin of sourcePins) {
  const root = path.join(sourceRoot, pin.name);
  const actualHead = sourceHeadFromGitMetadata(root);
  const inventoryEntry = sourceInventory.find((x) => x.name === pin.name);
  const candidates = walkPackageManifests(root);
  const nameKeys = sourceToPlanKeys[pin.name] || [];
  const verificationRefs = nameKeys.map((key) => ({ packageKey: key, commit: plan.verificationRefs?.[key] || null }));
  const verificationRefRelation = verificationRefs.map((v) => ({
    ...v,
    equalsSourceHead: v.commit ? v.commit === actualHead : null,
    ancestryChecked: false,
  }));
  const source = {
    name: pin.name,
    pinnedHead: pin.head,
    actualHead,
    pinMatchesActualHead: pin.head === actualHead,
    branchStatusFromSourcePins: pin.status,
    postFetchInventoryHead: inventoryEntry?.head || null,
    postFetchInventoryAction: inventoryEntry?.action || null,
    verificationRefs,
    verificationRefRelation,
    packageManifestCandidates: candidates.map((x) => ({ ...x, relativePath: rel(x.path, root) })),
  };
  report.sources.push(source);
  mark(`source-head:${pin.name}`, pin.head === actualHead, `Pinned head ${pin.head}; actual source checkout head ${actualHead}.`);
  for (const key of nameKeys) {
    const packageName = key === 'cli' ? '@openpresentation/cli' : `@openpresentation/${key}`;
    const planVersion = planByName.get(packageName)?.version;
    const matching = candidates.filter((x) => x.name === packageName);
    const exact = matching.some((x) => x.version === planVersion);
    mark(`source-version:${packageName}`, exact, `Source package manifests ${JSON.stringify(matching.map((x) => ({ version: x.version, path: rel(x.path, root) })))}; release plan ${planVersion}.`);
  }
}

const getRuntimeTarget = (value) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) { for (const v of value) { const t = getRuntimeTarget(v); if (t) return t; } return null; }
  if (value && typeof value === 'object') {
    for (const key of ['import', 'node', 'default', 'require']) if (Object.hasOwn(value, key)) {
      const t = getRuntimeTarget(value[key]); if (t) return t;
    }
    for (const [key, child] of Object.entries(value)) if (key !== 'types') {
      const t = getRuntimeTarget(child); if (t) return t;
    }
  }
  return null;
};
const filesUnder = (root) => {
  const out = [];
  const visit = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const p = path.join(d, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) visit(p);
      else if (ent.isFile()) out.push(p);
    }
  };
  visit(root);
  return out;
};
const checkResolvedEntry = (name, specifier, mode = 'import') => {
  let url;
  let resolutionError = null;
  try {
    url = import.meta.resolve(specifier);
  } catch (e) { resolutionError = `${e.code || e.name}: ${e.message}`; }
  let resolvedPath = null;
  let realpath = null;
  let packageRoot = pkgFolder(consumerRoot, name);
  let packageRealpath = null;
  let pathWithinPackage = false;
  let symlinkSegments = [];
  if (url?.startsWith('file:')) {
    resolvedPath = fileURLToPath(url);
    try { realpath = fs.realpathSync.native(resolvedPath); } catch (e) { resolutionError ||= `realpath: ${e.message}`; }
    try { packageRealpath = fs.realpathSync.native(packageRoot); } catch (e) { resolutionError ||= `package realpath: ${e.message}`; }
    pathWithinPackage = Boolean(realpath && packageRealpath && within(realpath, packageRealpath));
    let cursor = path.parse(resolvedPath).root;
    for (const part of resolvedPath.slice(cursor.length).split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      try { if (fs.lstatSync(cursor).isSymbolicLink()) symlinkSegments.push(cursor); } catch { }
    }
  }
  const ok = Boolean(url && !resolutionError && resolvedPath && fileExists(resolvedPath) && realpath && pathWithinPackage && symlinkSegments.length === 0);
  const entry = { package: name, specifier, mode, resolvedUrl: url || null, resolvedPath, realpath, packageRoot, packageRealpath, pathWithinPackage, symlinkSegments, status: ok ? 'pass' : 'fail', error: resolutionError };
  report.publicExports.push(entry);
  mark(`public-export:${name}:${specifier}:${mode}`, ok, `resolved=${resolvedPath}; realpath=${realpath}; insidePackage=${pathWithinPackage}; symlinkSegments=${JSON.stringify(symlinkSegments)}${resolutionError ? `; error=${resolutionError}` : ''}.`);
};
for (const name of fiveNames) {
  const root = pkgFolder(consumerRoot, name);
  const manifest = readJson(path.join(root, 'package.json'));
  if (manifest.exports) {
    const exportMap = typeof manifest.exports === 'string' || Array.isArray(manifest.exports) ? { '.': manifest.exports } : manifest.exports;
    for (const [key, value] of Object.entries(exportMap)) {
      const target = getRuntimeTarget(value);
      if (!target) continue;
      const specifierBase = key === '.' ? name : key.startsWith('./') ? name + key.slice(1) : null;
      if (!specifierBase) continue;
      if (!key.includes('*')) {
        checkResolvedEntry(name, specifierBase, 'import');
        continue;
      }
      if (typeof target === 'string' && target.includes('*')) {
        const star = target.indexOf('*');
        const targetPrefix = target.slice(0, star);
        const targetDir = path.resolve(root, targetPrefix).replace(/[\\/]+$/, '');
        const prefixDir = targetDir;
        for (const file of filesUnder(targetDir)) {
          const relativeTarget = rel(file, prefixDir);
          const subpath = key.replace('*', relativeTarget);
          checkResolvedEntry(name, name + subpath.slice(1), 'import');
        }
      }
    }
  } else if (manifest.bin) {
    const bins = typeof manifest.bin === 'string' ? { [name.split('/').at(-1)]: manifest.bin } : manifest.bin;
    for (const [binName, binTarget] of Object.entries(bins)) {
      const resolvedPath = path.resolve(root, binTarget);
      const realpath = fs.realpathSync.native(resolvedPath);
      const packageRealpath = fs.realpathSync.native(root);
      const pathWithinPackage = within(realpath, packageRealpath);
      const symlinkSegments = [];
      let cursor = path.parse(resolvedPath).root;
      for (const part of resolvedPath.slice(cursor.length).split(path.sep).filter(Boolean)) {
        cursor = path.join(cursor, part);
        try { if (fs.lstatSync(cursor).isSymbolicLink()) symlinkSegments.push(cursor); } catch { }
      }
      const ok = fileExists(resolvedPath) && pathWithinPackage && symlinkSegments.length === 0;
      const entry = { package: name, specifier: `bin:${binName}`, mode: 'bin-manifest', resolvedUrl: pathToFileURL(resolvedPath).href, resolvedPath, realpath, packageRoot: root, packageRealpath, pathWithinPackage, symlinkSegments, status: ok ? 'pass' : 'fail', error: null };
      report.publicExports.push(entry);
      mark(`public-bin:${name}:${binName}`, ok, `resolved=${resolvedPath}; realpath=${realpath}; insidePackage=${pathWithinPackage}; symlinkSegments=${JSON.stringify(symlinkSegments)}.`);
    }
  } else {
    mark(`public-surface:${name}`, false, 'Package has no exports map or bin entry in its installed manifest.');
  }
}

const openPresentationCopies = [];
const visited = new Set();
const inspectNodeModules = (nm) => {
  let realNm;
  try { realNm = fs.realpathSync.native(nm); } catch { return; }
  if (visited.has(realNm)) return;
  visited.add(realNm);
  const scope = path.join(nm, '@openpresentation');
  if (dirExists(scope)) {
    for (const ent of fs.readdirSync(scope, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const pkgRoot = path.join(scope, ent.name);
      const manifestPath = path.join(pkgRoot, 'package.json');
      if (!fileExists(manifestPath)) continue;
      const manifest = readJson(manifestPath);
      if (!fiveNames.includes(manifest.name)) continue;
      openPresentationCopies.push({
        name: manifest.name,
        version: manifest.version,
        location: pkgRoot,
        relativeLocation: rel(pkgRoot, consumerRoot),
        realpath: fs.realpathSync.native(pkgRoot),
        depth: rel(pkgRoot, consumerRoot).split('/').filter((x) => x === 'node_modules').length - 1,
        declaredDirectDependency: Object.hasOwn(rootDeps, manifest.name),
      });
    }
  }
};
const findNestedNodeModules = (directory) => {
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const child = path.join(directory, entry.name);
    if (entry.name === 'node_modules') {
      inspectNodeModules(child);
      findNestedNodeModules(child);
    }
    else findNestedNodeModules(child);
  }
};
findNestedNodeModules(consumerRoot);
report.openPresentationCopies = openPresentationCopies.sort((a, b) => a.name.localeCompare(b.name) || a.location.localeCompare(b.location));
for (const name of fiveNames) {
  const copies = openPresentationCopies.filter((x) => x.name === name);
  const directCopies = copies.filter((x) => x.depth === 0);
  const nestedCopies = copies.filter((x) => x.depth > 0);
  mark(`package-copy:${name}`, directCopies.length === 1, `directCopies=${directCopies.length}; nestedCopies=${nestedCopies.length}; versions=${copies.map((x) => `${x.version}@${x.relativeLocation}`).join(', ') || 'none'}.`);
}

const fontLockEntries = Object.entries(lock.packages || {}).filter(([k]) => k.startsWith('node_modules/@expo-google-fonts/'));
for (const [lockKey, lockEntry] of fontLockEntries) {
  const name = lockKey.slice('node_modules/'.length);
  const root = pkgFolder(consumerRoot, name);
  const manifestPath = path.join(root, 'package.json');
  const manifest = fileExists(manifestPath) ? readJson(manifestPath) : null;
  const allFiles = dirExists(root) ? filesUnder(root) : [];
  const fontFiles = allFiles.filter((p) => /\.(ttf|otf|woff2?|woff)$/i.test(p));
  const licenseFiles = allFiles.filter((p) => /(^|\/)(license|licence|copying|ofl|open.?font.?license)([^/]*$)/i.test(rel(p, root)));
  const fontEntry = {
    name,
    version: lockEntry.version,
    resolved: lockEntry.resolved,
    integrity: lockEntry.integrity,
    lockLicense: lockEntry.license || null,
    installedVersion: manifest?.version || null,
    installedLicense: manifest?.license || null,
    fontFileCount: fontFiles.length,
    fonts: fontFiles.map((p) => ({ path: rel(p, root), bytes: fs.statSync(p).size, sha256: sha256File(p) })),
    licenseFiles: licenseFiles.map((p) => ({ path: rel(p, root), bytes: fs.statSync(p).size, sha256: sha256File(p) })),
    packagePresent: Boolean(manifest),
  };
  report.fonts.push(fontEntry);
  mark(`font-package:${name}`, Boolean(manifest && manifest.version === lockEntry.version && manifest.license === lockEntry.license && lockEntry.integrity && lockEntry.resolved && fontFiles.length > 0), `version lock/installed=${lockEntry.version}/${manifest?.version}; license lock/installed=${lockEntry.license}/${manifest?.license}; integrityPresent=${Boolean(lockEntry.integrity)}; fontFiles=${fontFiles.length}; licenseFiles=${licenseFiles.length}.`);
}

const installedNodePkg = readJson(path.join(nodeRoot, 'package.json'));
const nodeVersionInventoryPath = path.join(artifactRoot, 'node24-registry-versions.json');
const nodeVersionInventory = readJson(nodeVersionInventoryPath);
report.runtime.packageManifestVersion = installedNodePkg.version;
report.runtime.pinnedVersionListContainsObserved = nodeVersionInventory.includes(process.version.replace(/^v/, ''));
report.runtime.versionInventorySha256 = sha256File(nodeVersionInventoryPath);
mark('node-package-version', installedNodePkg.version === process.version.replace(/^v/, ''), `Node package manifest=${installedNodePkg.version}; executable=${process.version}.`);
mark('node-version-inventory', report.runtime.pinnedVersionListContainsObserved, `node24-registry-versions.json contains ${process.version}.`);

report.checks = checks;
report.failures = failures;
report.summary = {
  status: failures.length === 0 ? 'pass' : 'fail',
  checkCount: checks.length,
  passCount: checks.filter((c) => c.status === 'pass').length,
  failCount: failures.length,
};
report.auditScript = {
  path: auditScriptPath,
  sha256: sha256File(auditScriptPath),
};
report.auditFinishedUtc = new Date().toISOString();
const reportPath = path.join(auditDir, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' });
console.log(JSON.stringify({ reportPath, status: report.summary.status, summary: report.summary, failures, scriptSha256: report.auditScript.sha256, packageLockSha256: report.inputHashes.packageLockSha256 }, null, 2));
