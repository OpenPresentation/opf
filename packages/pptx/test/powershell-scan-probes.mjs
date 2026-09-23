// Independent-review probes for the native harness source policies (opf-pptx#62). Each payload is appended to a real
// harness and must be rejected by that harness's Node audit (a failure code the unmodified source does not produce)
// and, on Windows, by its PowerShell AST check. They cover lexer desync, dynamic invocation, member indirection,
// alias indirection and COM assignment through local-root aliasing.
const LEFT = String.fromCharCode(0x2018), RIGHT = String.fromCharCode(0x2019);

export const SOURCE_POLICY_PROBES = Object.freeze([
  // Lexer: a braced variable, a lone CR, a glued comment or an escaped character must not hide code.
  ['braced-variable-quote-quit', '$probe = "${x"}"; $app.Quit() # "'],
  ['braced-variable-quote-iex', '$probe = "${x"}"; iex $y # "'],
  ['braced-variable-quote-com-assignment', '$probe = "${x"}"; $app.DisplayAlerts = 1 # "'],
  ['lone-cr-here-string-quit', "$probe = @'\r\nfoo\r'@\r$app.Quit()\r\n'@"],
  ['lone-cr-here-string-iex', "$probe = @'\r\nfoo\r'@\riex $y\r\n'@"],
  ['block-comment-mid-word', 'Write-Output a<#x#>b; $app.Quit()'],
  ['glued-hash-comment', 'Write-Output "a"#b\r\n$app.Quit()'],
  ['backtick-escaped-iex', 'i`ex $y'],
  ['line-continued-iex', 'Invoke-Expression `\r\n $y'],
  ['typographic-quotes-iex', `$probe = ${LEFT}abc${RIGHT}; iex $y`],
  // Code inside expandable strings is code.
  ['subexpression-in-string', '$probe = "$( $app.Quit() )"'],
  ['nested-subexpression', '$probe = "a $( "b $( $app.Quit() )" ) c"'],
  ['here-string-subexpression', '$probe = @"\r\nhi $( $app.Quit() )\r\n"@'],
  // Dynamic commands and invocation.
  ['iex-uppercase', 'IEX $y'],
  ['iex-in-subexpression', '$($(iex $y))'],
  ['dot-source-after-equals', '$probe=. $y'],
  ['dot-source-expandable-string', '. "$y"'],
  ['call-expandable-string', '& "$y"'],
  ['set-alias-iex', "Set-Alias zz ('Invoke-'+'Expression'); zz $y"],
  ['new-alias-iex', 'New-Alias zz Invoke-Expression; zz $y'],
  ['expand-string', '$null=(Get-Variable ExecutionContext -ValueOnly).InvokeCommand.ExpandString($y)'],
  ['powershell-add-script', '$null=[powershell]::Create().AddScript($y).Invoke()'],
  ['type-cast-scriptblock-create', "$null=([type]'scriptblock')::Create($y).Invoke()"],
  ['scriptblock-type-variable', '$t=[scriptblock]; $null=$t::Create($y)'],
  // Member indirection that reaches Quit.
  ['quit-invoke', '$app.Quit.Invoke()'],
  ['quit-string-name-invoke', "$app.'Quit'.Invoke()"],
  ['quit-psobject-method', "$app.PSObject.Methods['Quit'].Invoke()"],
  ['quit-foreach-member-name', '$app | ForEach-Object Quit'],
  ['quit-percent-alias', '$app | % Quit'],
  ['dynamic-member-invoke', '$app.$name.Invoke()'],
  // COM assignment outside the documented setters.
  ['setter-method', '$wholeFont.set_Name("x")'],
  ['setter-behind-member', '$x.wholeFont.Name = "x"'],
  ['com-index-assignment', '$app["Visible"] = 1'],
  ['com-psobject-property', '$app.PSObject.Properties["Visible"].Value = 1'],
  ['local-root-alias', '$report = $app; $report.Visible = 0'],
  ['local-root-multiple-assignment', '$report, $x = $app, 1; $report.Visible = 0'],
  ['local-root-foreach', 'foreach($report in @($app)) { $report.Visible = 0 }'],
  ['local-root-parameter', 'function Set-ProbeValue($report) { $report.Visible = 0 }'],
  ['local-root-out-variable', 'Write-Output $app -OutVariable report; $report[0].Visible = 0'],
  // Second review: an invocation site trusts its variable only through the variable's reviewed binding.
  ['site-variable-rebind', "$processSnapshot = Join-Path $env:TEMP 'evil.ps1'; . $processSnapshot"],
  ['site-variable-scope-rebind', "function Set-ProbeSite { $script:fontHelperSnapshot = 'C:/probe/evil.ps1' }"],
  ['com-wrapper-redefined-untyped', 'function {COM}([string]$StageName,$Operation) { & $Operation }'],
  ['com-wrapper-operation-reassigned', 'function {COM}([string]$StageName,[scriptblock]$Operation) { $Operation = $null; & $Operation }'],
  ['pure-regression-redefined', 'function {PURE} { $decide = $y; & $decide }'],
  ['function-drive-redefinition', '${function:{COM}} = { param($StageName,$Operation) & $Operation }'],
  // Native helpers and file-system writes are pinned to their reviewed argument forms and owned paths.
  ['native-worker-any-script', '$null=Invoke-OpfNativeWorker -ScriptPath $env:TEMP -WorkerArguments @() -OutputDirectory $outputRoot -TimeoutSeconds 5'],
  ['temporary-fonts-bare-path', 'Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot C:/probe -RunRoot $outputRoot -Action { }'],
  ['remove-item-any-path', 'Remove-Item -LiteralPath $env:USERPROFILE -Recurse -Force'],
  ['remove-item-splat', "$probe=@{LiteralPath='C:/probe';Recurse=$true}; Remove-Item @probe"],
  ['write-all-text-profile', "[IO.File]::WriteAllText($PROFILE, 'probe')"],
  ['redirection-to-profile', "'probe' > $PROFILE"],
  ['set-content-profile', "'probe' | Set-Content -LiteralPath $PROFILE"],
  ['copy-item-other-destination', 'Copy-Item -LiteralPath $inputPath -Destination $PROFILE'],
  ['owned-root-rebind', '$outputRoot = $env:USERPROFILE'],
  ['stage-file-rebind', '$script:stageFile = $PROFILE'],
  ['pinned-foreach-rebind', 'foreach($outputRoot in @($env:USERPROFILE)) { }'],
  ['pinned-increment', '$stageFile++'],
  ['saveas-other-path', '$script:presentation.SaveAs($PROFILE,24,0)'],
  // Runtime state through variable drives.
  ['braced-variable-drive-execution-context', "$null=${variable:ExecutionContext}.InvokeCommand.GetCommandName('x',$true,$true)"],
  ['braced-variable-drive-invoke-script', "$null=${variable:ExecutionContext}.InvokeCommand.InvokeScript('x')"],
  ['unbraced-variable-drive-execution-context', "$null=$variable:ExecutionContext.InvokeCommand.InvokeScript('x')"],
  // Bare arguments are checked by both layers.
  ['unlisted-bare-argument', 'Test-Path -PathType Container $outputRoot'],
]);

// Allowed in the embed harness, whose documented setters include wholeFont.Name.
export const SOURCE_POLICY_PROBE_POSITIVES = Object.freeze([
  ['documented-setter', '$wholeFont.Name = "x"'],
  ['documented-setter-script-scope', '$script:wholeFont.Name = "x"'],
]);

// {COM} and {PURE} name the harness's COM wrapper and pure-regression function.
export function injectProbe(source, payload, {com = 'Invoke-ProbeCom', pure = 'Invoke-ProbePureRegression'} = {}) {
  return source.replace(/\s*$/, `\r\n${payload.replaceAll('{COM}', com).replaceAll('{PURE}', pure)}\r\n`);
}

// Asserts that every probe is rejected (and every positive accepted) by one harness's Node audit and, on Windows, by
// its PowerShell AST check through test/native-source-policy-probes.ps1. Returns counts for the controls report.
export async function assertSourcePolicyProbes({source, audit, harnessPath, assertFunction, positives = [], names = {}}) {
  const {default: assert} = await import('node:assert/strict');
  const baseline = new Set(audit(source).map(item => item.code));
  for (const [name, payload] of SOURCE_POLICY_PROBES) {
    const added = audit(injectProbe(source, payload, names)).map(item => item.code).filter(code => !baseline.has(code));
    assert.ok(added.length > 0, `Node audit accepted probe ${name}`);
  }
  for (const [name, payload] of positives) assert.deepEqual(audit(injectProbe(source, payload)), audit(source), `Node audit rejected positive ${name}`);
  if (process.platform !== 'win32') return {node: SOURCE_POLICY_PROBES.length + positives.length, powershell: 'skipped: non-Windows runner'};
  const [{spawnSync}, {mkdtemp, rm, writeFile}, os, path, {fileURLToPath}] = await Promise.all([import('node:child_process'), import('node:fs/promises'), import('node:os'), import('node:path'), import('node:url')]);
  const directory = await mkdtemp(path.join(path.resolve(os.tmpdir()), 'opf-source-policy-probes-'));
  try {
    for (const [name, payload] of SOURCE_POLICY_PROBES) await writeFile(path.join(directory, `${name}.ps1`), injectProbe(source, payload, names));
    for (const [name, payload] of positives) await writeFile(path.join(directory, `positive-${name}.ps1`), injectProbe(source, payload));
    const ps = path.join(process.env.WINDIR ?? 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const driver = path.join(path.dirname(fileURLToPath(import.meta.url)), 'native-source-policy-probes.ps1');
    const child = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', driver, '-HarnessPath', harnessPath, '-AssertFunction', assertFunction, '-ProbeDirectory', directory], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 600_000, windowsHide: true});
    assert.equal(child.status, 0, child.error?.message ?? (child.stderr || child.stdout));
    const results = JSON.parse(child.stdout.replace(/^\uFEFF/, ''));
    for (const [name] of SOURCE_POLICY_PROBES) assert.ok(typeof results[name] === 'string' && results[name].length > 0, `PowerShell AST check accepted probe ${name}`);
    for (const [name] of positives) assert.equal(results[`positive-${name}`], null, `PowerShell AST check rejected positive ${name}`);
    return {node: SOURCE_POLICY_PROBES.length + positives.length, powershell: SOURCE_POLICY_PROBES.length + positives.length};
  } finally { await rm(directory, {recursive: true, force: true}); }
}
