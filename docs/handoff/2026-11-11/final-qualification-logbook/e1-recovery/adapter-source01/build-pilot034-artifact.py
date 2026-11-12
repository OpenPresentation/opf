# Prospective offline adapter. SOURCE ONLY until reviewed; does not render, import OPF or publish.
import argparse, base64, copy, hashlib, html, json, pathlib, re, struct, zipfile
from html.parser import HTMLParser
from datetime import date as calendar_date

sha = lambda b: hashlib.sha256(b).hexdigest()
identity = lambda b: {'bytes': len(b), 'sha256': sha(b)}
encode = lambda value: (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
RECOVERY_SHA = '901296967ae1cad3c709cbb65f58f4277261133ec00a704c385a40b6ad458816'
RECOVERY_COMMIT = '442ad549d53131cfb32b5c65d974777f33f68a67'
PILOT_COMMIT = 'c3e7196aca3c3f18242b405ff870b8bace768fd8'
FONT_SHA = '3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62'
LICENSE_SHA = '3b0a5fca3d17942cde889069889dedbbbd075e9b599968c82a95f4d944e9b345'
PACKAGES = {'@openpresentation/' + name for name in ['opf', 'gallery', 'opf-render', 'opf-pptx', 'opf-editor', 'cli', 'mcp']}

def read(file):
    file = pathlib.Path(file)
    assert file.is_file() and not file.is_symlink(), 'One regular input file required'
    return file.read_bytes()

def child(root, relative):
    assert isinstance(relative, str) and relative and '\\' not in relative and ':' not in relative
    parts = relative.split('/')
    assert all(part not in ['', '.', '..'] for part in parts), 'Unsafe artifact relative path'
    file = root.joinpath(*parts)
    assert file.resolve().is_relative_to(root.resolve()) and file.resolve() != root.resolve()
    for ancestor in [file, *file.parents]:
        if ancestor == root.parent:
            break
        assert not ancestor.is_symlink(), 'Linked artifact input refused'
    return file

def checked(root, relative, expected):
    data = read(child(root, relative))
    assert identity(data) == {key: expected[key] for key in ['bytes', 'sha256']}, relative
    return data

def png(data):
    assert len(data) > 24 and data[:8] == b'\x89PNG\r\n\x1a\n'
    width, height = struct.unpack('>II', data[16:24])
    assert width > 0 and height > 0
    return {'width': width, 'height': height}

def pointer_parts(value):
    assert isinstance(value, str) and value.startswith('/')
    tokens = value[1:].split('/')
    assert all(re.search(r'~(?![01])', token) is None for token in tokens)
    return [token.replace('~1', '/').replace('~0', '~') for token in tokens]

def owner_at(value, tokens):
    for token in tokens:
        value = value[int(token)] if isinstance(value, list) else value[token]
    assert isinstance(value, dict)
    return value

def typed_rename_map(schema):
    defs = schema['$defs']; slide = defs['Slide']; furniture = defs['HeaderFooter']
    assert schema['properties']['design']['$ref'] == '#/$defs/Design'
    assert slide['properties']['design']['$ref'] == '#/$defs/SlideDesign'
    assert any(value.get('$ref') == '#/$defs/Design' for value in defs['SlideDesign']['allOf'])
    assert slide['additionalProperties'] is False and furniture['additionalProperties'] is False
    columns = ['start', 'center', 'end', 'start+center', 'center+end', 'start+center+end']
    rows = ['top', 'middle', 'bottom', 'top+middle', 'middle+bottom', 'top+middle+bottom']
    regions = columns + rows + [row + ':' + column for row in rows for column in columns]
    assert {key for key, value in slide['properties'].items() if value.get('$ref') == '#/$defs/ContentPayload'} == set(regions)
    assert list(furniture['properties']) == ['start', 'center', 'end']
    for name in ['header', 'footer']:
        assert name not in slide['properties']
        assert any(value.get('$ref') == '#/$defs/HeaderFooter' for value in defs['Design']['properties'][name]['oneOf'])
    return {key.replace('start', 'left').replace('end', 'right'): key for key in regions}, slide['properties'], furniture['properties']

def same_json(left, right):
    if isinstance(left, dict):
        return isinstance(right, dict) and set(left) == set(right) and all(same_json(left[key], right[key]) for key in left)
    if isinstance(left, list):
        return isinstance(right, list) and len(left) == len(right) and all(same_json(a, b) for a, b in zip(left, right))
    if type(left) in [int, float] and type(right) in [int, float]:
        return left == right
    return type(left) is type(right) and left == right

def inverse_projection(original, current, projection, schema):
    assert projection['policy'] == 'opf-e3-comparison-input-034/v1'
    assert set(projection) == {'policy', 'release', 'originalSha256', 'currentGallerySha256', 'projectedSha256', 'changes'}
    assert re.fullmatch('[a-f0-9]{64}', projection['currentGallerySha256'])
    expected = copy.deepcopy(original); expected.pop('catalogs', None)
    forward = copy.deepcopy(expected); regions, allowed_slide, allowed_furniture = typed_rename_map(schema)
    changes = []
    def rename(owner, base, names, allowed):
        assert isinstance(owner, dict)
        targets = [names.get(key, key) for key in owner]
        assert len(targets) == len(set(targets)) and all(key in allowed for key in targets)
        replacement = {}
        for key, value in owner.items():
            target = names.get(key, key); replacement[target] = value
            if target != key:
                escape = lambda text: text.replace('~', '~0').replace('/', '~1')
                changes.append({'from': base + '/' + escape(key), 'to': base + '/' + escape(target)})
        owner.clear(); owner.update(replacement)
    def design(value, base):
        if value is None: return
        assert isinstance(value, dict)
        for name in ['header', 'footer']:
            if name in value and value[name] is not False:
                rename(value[name], base + '/' + name, {'left': 'start', 'right': 'end'}, allowed_furniture)
    design(forward.get('design'), '/design')
    for index, slide in enumerate(forward['slides']):
        rename(slide, '/slides/' + str(index), regions, allowed_slide)
        design(slide.get('design'), '/slides/' + str(index) + '/design')
    assert changes == projection['changes'], 'Every recorded typed change must equal the actual schema-owned key mapping'
    assert same_json(forward, current), 'All values, order within arrays, boundaries and non-key content must remain exact'
    inverse = copy.deepcopy(current)
    for change in reversed(changes):
        old, new = pointer_parts(change['from']), pointer_parts(change['to'])
        assert old[:-1] == new[:-1]
        owner = owner_at(inverse, new[:-1]); assert old[-1] not in owner and new[-1] in owner
        owner[old[-1]] = owner.pop(new[-1])
    assert same_json(inverse, expected), 'Literal inverse must restore the original minus checked catalog snapshots'
    return changes

class Check(HTMLParser):
    def __init__(self):
        super().__init__(); self.articles = []; self.images = []; self.downloads = []; self.bad = []; self.scripts = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'article': self.articles.append(attrs['id'])
        if tag == 'img': self.images.append(attrs)
        if tag == 'script': self.scripts += 1
        if tag == 'a' and 'download' in attrs: self.downloads.append(attrs)
        for key in ['src', 'href']:
            if key in attrs and not attrs[key].startswith(('data:', '#')): self.bad.append((tag, key))

CSS = '@font-face{font-family:EvidenceInter;src:url(FONT) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}*{box-sizing:border-box}html{color-scheme:light;scroll-behavior:smooth}body{margin:0;background:#f5f6f8;color:#172434;font:16px/1.55 EvidenceInter,Arial,sans-serif}header,main,footer{max-width:1800px;margin:auto;padding:32px clamp(16px,3vw,48px)}header{padding-bottom:12px}h1{font-size:clamp(28px,3vw,44px);line-height:1.16;letter-spacing:-.035em;margin:6px 0 18px}h2{font-size:18px;margin:0 0 12px}h2 a{color:inherit;text-decoration:none}h2 span{font-weight:500;margin-left:12px}.eyebrow{font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#486277}p{max-width:88ch}.intro{font-size:18px}.caveat{border-left:4px solid #bf8b35;padding:12px 16px;background:#fff8e9}.downloads{display:flex;gap:12px 24px;flex-wrap:wrap;margin:22px 0}a{color:#125c96;text-underline-offset:3px}details{background:white;border:1px solid #dce1e7;border-radius:8px;padding:14px 18px;margin:16px 0}summary{cursor:pointer;font-weight:650}.identity{font-size:13px;overflow-wrap:anywhere}article{padding:22px 0 28px;border-top:1px solid #d5dce4;scroll-margin-top:20px}.triptych{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}figure{margin:0;min-width:0}figcaption{font-size:13px;font-weight:650;margin-bottom:7px}img{width:100%;height:auto;display:block;background:white;border:1px solid #d5dce4}.cover-note{font-size:14px;margin:0 0 14px;color:#654312}li{margin:7px 0}footer{font-size:13px;color:#506173;padding-top:0}@media(max-width:760px){.triptych{grid-template-columns:1fr;gap:20px}header,main,footer{padding:22px 16px}article{padding:20px 0}h2{font-size:16px}}@media print{details{display:block}.triptych{grid-template-columns:repeat(3,minmax(0,1fr))}article{break-inside:avoid}a{color:inherit}}'

def main():
    parser = argparse.ArgumentParser(description='Prospective034 offline pilot adapter; consumes accepted existing images only')
    for flag in ['render-root', 'out', 'recovery-json', 'schema', 'viewer-root', 'expect-release', 'expect-commit', 'expect-receipt-sha256', 'expect-authority-sha256']:
        parser.add_argument('--' + flag, required=True)
    args = parser.parse_args()
    root = pathlib.Path(args.render_root).resolve(strict=True); out = pathlib.Path(args.out)
    assert not out.exists() and not out.is_symlink(), 'Fresh artifact destination required'
    assert re.fullmatch(r'0\.34\.\d+', args.expect_release)
    assert re.fullmatch('[a-f0-9]{40}', args.expect_commit)
    for digest in [args.expect_receipt_sha256, args.expect_authority_sha256]: assert re.fullmatch('[a-f0-9]{64}', digest)
    receipt_bytes = read(root / 'receipt.json'); authority_bytes = read(root / 'authority.json')
    assert sha(receipt_bytes) == args.expect_receipt_sha256 and sha(authority_bytes) == args.expect_authority_sha256
    receipt = json.loads(receipt_bytes); authority = json.loads(authority_bytes)
    assert receipt['schema'] == 'opf-e1-current-after/v1' and receipt['mode'] == 'render' and receipt['complete'] is True and 'failure' not in receipt
    assert receipt['release'] == authority['release'] == args.expect_release
    assert receipt['releaseCommit'] == authority['commit'] == args.expect_commit
    assert receipt['registryVerifiedAt'] == authority['verifiedAt'] and authority['verifiedAt']
    assert len(authority['packages']) == 7 and {row['name'] for row in authority['packages']} == PACKAGES
    for row in authority['packages']:
        assert row['version'] == args.expect_release and row['gitHead'] == args.expect_commit
        assert row['integrity'].startswith('sha512-') and row['tarball'].startswith('https://registry.npmjs.org/')
        assert row['attestations']['provenance']['predicateType'] == 'https://slsa.dev/provenance/v1'
    for row in receipt['consumer']['packages']:
        proof = next(item for item in authority['packages'] if item['name'] == row['name'])
        assert all(row[key] == proof[key] for key in ['name', 'version', 'integrity', 'tarball', 'gitHead'])
    assert len(receipt['consumer']['packages']) == 6 and {row['name'] for row in receipt['consumer']['packages']} == PACKAGES - {'@openpresentation/mcp'}
    runtime_bytes = read(root / 'installed-runtime.json'); runtime = json.loads(runtime_bytes)
    assert isinstance(runtime, list) and runtime
    assert all(set(row) == {'path', 'bytes', 'sha256'} and isinstance(row['path'], str) and type(row['bytes']) is int and row['bytes'] >= 0 and re.fullmatch('[a-f0-9]{64}', row['sha256']) for row in runtime)
    assert len({row['path'] for row in runtime}) == len(runtime)
    # These closed string/integer records serialize exactly as the maintained JSON.stringify seal.
    assert sha(json.dumps(runtime, ensure_ascii=False, separators=(',', ':')).encode()) == receipt['consumer']['runtimeInventorySha256']
    recovery_bytes = read(pathlib.Path(args.recovery_json)); assert sha(recovery_bytes) == RECOVERY_SHA
    recovery = json.loads(recovery_bytes)
    assert receipt['recovery']['commit'] == RECOVERY_COMMIT and receipt['recovery']['sha256'] == RECOVERY_SHA
    assert receipt['scope']['availableCorpus'] == 844 and receipt['scope']['publishedSubset'] == 550
    assert receipt['scope']['missingBefore'] == recovery['corpus']['missing']
    decks = receipt['decks']; expected_ids = ['overview', 'pilot'] + [row['batch'] for row in recovery['corpus']['batches']]
    assert [row['id'] for row in decks] == expected_ids and len(decks) == receipt['scope']['renderedDecks'] == 20
    assert receipt['options']['only'] is None and receipt['renderedSlides'] == 940
    assert [len(decks[0]['slides']), len(decks[1]['slides']), sum(len(row['slides']) for row in decks[2:])] == [53, 43, 844]
    all_after = []
    for deck in decks:
        assert deck['complete'] is True and len(deck['outputs']) == len(deck['slides'])
        for index, (slide, output) in enumerate(zip(deck['slides'], deck['outputs']), 1):
            assert slide['ordinal'] == output['ordinal'] == index
            image = checked(root, 'decks/' + deck['id'] + '/after/' + output['file'], output)
            assert png(image) == {key: output[key] for key in ['width', 'height']}
            all_after.append({'deck': deck['id'], 'ordinal': index, **identity(image)})
    assert len(all_after) == 940
    entry = decks[1]; pilot = root / 'decks/pilot'
    assert entry['fonts']['pack'] == 'office' and entry['fonts']['substitutionPolicy'] == 'visual' and entry['fonts']['userFonts'] == []
    assert entry['sourceCommit'] == PILOT_COMMIT and entry['publishedBatch'] is False
    original_bytes = checked(pilot, 'original.opf.json', entry['original']); current_bytes = checked(pilot, 'current-gallery.opf.json', entry['current'])
    candidate = next(row for row in recovery['pilot']['sourceCandidates'] if row['commit'] == PILOT_COMMIT)
    assert sha(original_bytes) == candidate['sha256']
    original = json.loads(original_bytes); current = json.loads(current_bytes)
    projection = entry['comparisonInputProjection']
    assert projection['release'] == args.expect_release and projection['originalSha256'] == sha(original_bytes) and projection['projectedSha256'] == sha(current_bytes)
    schema_bytes = read(pathlib.Path(args.schema)); assert sha(schema_bytes) == receipt['tool']['comparisonSchema']['sha256']
    changes = inverse_projection(original, current, projection, json.loads(schema_bytes))
    if 'catalogs' in original:
        assert set(original['catalogs']) == {'default'} and set(original['catalogs']['default']) == {'source', 'layouts'}
        assert {row['id'] for row in entry['removedHistoricalSnapshots']} == set(original['catalogs']['default']['layouts'])
    else: assert entry['removedHistoricalSnapshots'] == []
    roster = recovery['pilot']['slides']; assert len(roster) == len(original['slides']) == len(current['slides']) == 43
    rows = []; figures = []; data = lambda mime, value: 'data:' + mime + ';base64,' + base64.b64encode(value).decode()
    release = args.expect_release; date = receipt['options']['date']; assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', date); calendar_date.fromisoformat(date)
    labels = [('before', 'Before · fixed control'), ('after', 'Published ' + release + ' · ' + date + ' render'), ('claude', 'Claude · fixed control')]
    for index, (record, slide, source_slide, fixed) in enumerate(zip(entry['slides'], current['slides'], original['slides'], roster), 1):
        sid = slide['id']; assert re.fullmatch('[a-zA-Z0-9][a-zA-Z0-9_-]*', sid)
        assert record['id'] == source_slide['id'] == fixed['id'] == sid and record['ordinal'] == fixed['ordinal'] == index
        panels = []
        for role, label in labels:
            if role == 'after':
                output = entry['outputs'][index - 1]; relative = 'after/' + output['file']; image = checked(pilot, relative, output)
            else:
                asset = next(row for row in recovery['assets'] if row['id'] == fixed[role])
                assert record[role]['asset'] == fixed[role] and record[role]['sha256'] == asset['sha256']
                relative = 'fixed/' + role + '-' + sid + '.png'; image = checked(pilot, relative, asset)
            dimensions = png(image); rows.append({'ordinal': index, 'id': sid, 'role': role, 'renderFile': relative, **identity(image), **dimensions})
            panels.append('<figure><figcaption>' + html.escape(label) + '</figcaption><img data-role="' + role + '" src="' + data('image/png', image) + '" width="' + str(dimensions['width']) + '" height="' + str(dimensions['height']) + '" alt="' + html.escape(label + ': ' + sid, quote=True) + '" loading="lazy" decoding="async"></figure>')
        caveat = '<p class="cover-note">Content caveat: this Claude cover contains no title or subtitle. It is not an equivalent-content comparison.</p>' if index == 1 else ''
        figures.append('<article id="' + sid + '"><h2><a href="#' + sid + '">' + str(index).zfill(2) + ' <span>' + sid + '</span></a></h2>' + caveat + '<div class="triptych">' + ''.join(panels) + '</div></article>')
    assert len({row['id'] for row in entry['slides']}) == 43 and len(rows) == 129
    viewer = pathlib.Path(args.viewer_root).resolve(strict=True)
    font = read(child(viewer, 'app/fonts/inter-latin-wght-normal.woff2')); license_bytes = read(child(viewer, 'app/fonts/inter.LICENSE.txt'))
    assert sha(font) == FONT_SHA and sha(license_bytes) == LICENSE_SHA
    manifest = {'schema': 'opf-published034-pilot-comparison/v1', 'publication': 'Offline preparation only; no visibility changed', 'release': release, 'releaseCommit': args.expect_commit, 'renderDate': date, 'renderReceipt': identity(receipt_bytes), 'authority': identity(authority_bytes), 'installedRuntime': identity(read(root / 'installed-runtime.json')), 'maintainedRuntimeInventorySha256': receipt['consumer']['runtimeInventorySha256'], 'runtimeRevalidatedByAdapter': False, 'recoveryCommit': RECOVERY_COMMIT, 'recoverySha256': RECOVERY_SHA, 'sourceCommit': PILOT_COMMIT, 'beforeProducer': 'Unknown; retained candidate is not proven as historical Before producer', 'coverCaveat': 'Claude cover omits title and subtitle; no equivalent-content parity claim', 'sources': {'original': identity(original_bytes), 'actual034Input': identity(current_bytes)}, 'comparisonInputProjection': projection, 'projectionVerification': {'recordedChangeCount': len(changes), 'completeLiteralInverse': True, 'originalAndProjectedBytesHashed': True, 'intermediateHash': 'Retained from exact sealed maintained receipt; intermediate bytes are not emitted by that runner'}, 'comparisonSchema': identity(schema_bytes), 'renderFonts': entry['fonts'], 'renderFindings': entry['findings'], 'viewerFont': {'family': 'Inter', 'package': '@fontsource-variable/inter@5.3.0', 'source': 'https://www.npmjs.com/package/@fontsource-variable/inter/v/5.3.0', 'license': 'OFL-1.1', 'sha256': FONT_SHA, 'licenseSha256': LICENSE_SHA}, 'counts': {'completeRenderedDecks': 20, 'completeRenderedSlides': 940, 'pilotSlides': 43, 'embeddedPNGs': 129}, 'images': rows, 'all940AfterImages': all_after, 'visualReview': 'PENDING; historical033 conclusions are not reused', 'execution': {'newRenders': 0, 'imageEdits': 0, 'office': False, 'network': False, 'siteBuild': False, 'visibilityChanged': False}}
    manifest_bytes = encode(manifest); files = {'sources/original.opf.json': original_bytes, 'sources/current-gallery.opf.json': current_bytes, 'manifest.json': manifest_bytes, 'licenses/Inter-OFL.txt': license_bytes}
    links = []
    for name, label in [('sources/original.opf.json', 'Original authored JSON'), ('sources/current-gallery.opf.json', 'Exact ' + release + ' render input'), ('manifest.json', 'Image & source manifest'), ('licenses/Inter-OFL.txt', 'Viewer font license')]:
        links.append('<a download="' + pathlib.Path(name).name + '" href="' + data('text/plain' if name.endswith('.txt') else 'application/json', files[name]) + '">' + html.escape(label) + '</a>')
    css = CSS.replace('FONT', data('font/woff2', font))
    body = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; font-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'; connect-src \'none\'"><title>Published ' + release + ' · 43-slide pilot comparison</title><style>' + css + '</style></head><body><header><div class="eyebrow">Published comparison · 43 slides</div><h1>Published ' + release + ' pilot</h1><p class="intro">43 actual published-release renders from ' + date + ', beside the exact fixed Before and Claude controls.</p><p>The Before producer remains unknown. Fixed controls can differ in content; these images alone do not establish equivalent-content parity or native/release acceptance.</p><nav class="downloads" aria-label="Evidence downloads">' + ''.join(links) + '</nav><details><summary>Source, fonts and review status</summary><p>Release ' + release + ': ' + args.expect_commit + '. The actual render input uses the release schema and the recorded typed property-name changes; all literal values and array boundaries invert exactly to the retained authored source. No controls were rerendered or resampled. Display scaling does not increase original image resolution.</p><p>Render fonts and findings, all PNG dimensions, actual source hashes and each recorded key change are retained in the manifest. Viewer UI uses pinned Inter/OFL. Actual034 visual review remains pending; no dated033 conclusions are reused.</p></details></header><main>' + ''.join(figures) + '</main><footer>Offline evidence preparation only. Publication and owner review remain separate.</footer></body></html>'
    check = Check(); check.feed(body)
    assert check.scripts == 0 and check.bad == [] and check.articles == [row['id'] for row in roster]
    assert len(check.images) == 129 and len(check.downloads) == 4
    for elem, row in zip(check.images, rows): assert identity(base64.b64decode(elem['src'].split(',', 1)[1], validate=True)) == {key: row[key] for key in ['bytes', 'sha256']}
    for elem, name in zip(check.downloads, files): assert base64.b64decode(elem['href'].split(',', 1)[1], validate=True) == files[name]
    files['comparison.html'] = body.encode()
    files['README.md'] = ('# Published ' + release + ' pilot comparison\n\nOpen comparison.html offline. All129 PNGs, font and four downloads are embedded. Actual034 visual review and publication remain pending. Unknown Before producer and unequal-content cover caveats remain. Exact render receipt/authority and full20-deck940 completion are bound in manifest.json. No new render, image edit or visibility change.\n').encode()
    out.mkdir(parents=True, exist_ok=False)
    for name, value in files.items():
        target = child(out.resolve(), name); target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream: stream.write(value)
    zip_name = 'published-' + release.replace('.', '-') + '-pilot-comparison.zip'
    with zipfile.ZipFile(out / zip_name, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, value in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=tuple(map(int, date.split('-'))) + (0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, value)
    with zipfile.ZipFile(out / zip_name) as archive:
        assert archive.testzip() is None and sorted(archive.namelist()) == sorted(files)
        for name, value in files.items(): assert archive.read(name) == value
    result = {'schema': 'opf-published034-offline-package-check/v1', 'sourceBuilder': identity(read(pathlib.Path(__file__))), 'inputs': {'renderReceipt': identity(receipt_bytes), 'authority': identity(authority_bytes), 'recovery': identity(recovery_bytes), 'schema': identity(schema_bytes)}, 'checks': {'complete940AfterHashesAndDimensions': True, 'pilotImages': 129, 'articleOrder': 43, 'recordedTypedChanges': len(changes), 'completeLiteralInverse': True, 'networkURLs': 0, 'scripts': 0, 'newRenders': 0, 'imageEdits': 0, 'browserExecuted': False, 'publication': False}, 'outputs': [{'file': name, **identity(value)} for name, value in files.items()] + [{'file': zip_name, **identity(read(out / zip_name))}]}
    with (out / 'receipt.json').open('xb') as stream: stream.write(encode(result))
    print(json.dumps({'out': str(out), 'release': release, 'images': 129, 'visualReview': 'PENDING', 'publication': False}))

if __name__ == '__main__':
    main()
