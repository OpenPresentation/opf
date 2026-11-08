// NEVERMERGE diagnostic derivation. Preserve the exact ce92 supervisor/lifecycle.
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('./', import.meta.url);
const baseline = zlib.gunzipSync(await fs.readFile(new URL('reference-worker.ps1.gz', root)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(baseline), 'de0905bd8024f3eebbd0518c338e67449c45f5e2de998714069d7a14210e1943');
const original = baseline.toString('utf8');
const nl = original.includes('\r\n') ? '\r\n' : '\n';
const lines = text => text.replaceAll('\r\n', '\n').replaceAll('\n', nl);
function once(text, anchor, replacement) {
  assert.equal(text.split(anchor).length, 2, 'Exactly one derivation anchor: ' + anchor.slice(0, 80));
  return text.replace(anchor, () => replacement);
}
const preflight = lines(`
# RR-105 NEVERMERGE: three exact offline-qualified inputs, no edit actions.
function Assert-FurnitureProofingInput([string]$Path,$Actions,[bool]$Fonts,[bool]$Survey) {
    if($Survey) { throw 'Proofing diagnostic forbids ReadOnlySurvey and its alternate shape cap' }
    if(-not $Fonts) { throw 'Proofing diagnostic requires CaptureTextFonts' }
    if($Actions -isnot [array] -or $Actions.Count -ne 0) { throw 'Proofing diagnostic requires an empty validated action plan' }
    $resolved=(Resolve-Path -LiteralPath $Path).Path
    if([IO.Path]::GetExtension($resolved) -ine '.pptx') { throw 'Proofing diagnostic input must be a PPTX archive' }
    if((Get-FurnitureSurveySlideCount $resolved) -ne 1) { throw 'Proofing diagnostic requires exactly one slide part' }
    $allowed=@('4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2','2d83ede6179333d73994af25e633129de05c44441ec3b0b570c19aa718152ad5','60fe2d29b96d30be594c115fd84332b0f5a14ac882f25d6ea8dcbbc655e3a5e4')
    if($allowed -cnotcontains (Get-FurnitureSha256 $resolved)) { throw 'Proofing diagnostic archive is not one of the three sealed A/B/C inputs' }
}

$proofingInput=(Resolve-Path -LiteralPath $InputPresentation).Path
$proofingActions=Read-AndValidateActionPlan $ActionPlan
Assert-FurnitureProofingInput $proofingInput $proofingActions ([bool]$CaptureTextFonts) ([bool]$ReadOnlySurvey)

`);
let result = once(original, 'if(-not $Worker) {', preflight + 'if(-not $Worker) {');
const snapshotGuard = 'Assert-FurnitureSurvey ([bool]$ReadOnlySurvey) $actions $sourceSnapshot';
result = once(result, snapshotGuard + nl, snapshotGuard + nl + 'Assert-FurnitureProofingInput $sourceSnapshot $actions ([bool]$CaptureTextFonts) ([bool]$ReadOnlySurvey)' + nl);
const phaseField = '    phases=[ordered]@{original=$null;edited=$null;reopened=$null}';
result = once(result, phaseField, lines(`    proofingLanguage=[ordered]@{expectedLanguageId=1025;api='PowerPoint.TextFrame.TextRange.LanguageID';observations=@();completedPhases=@();scope='Actual primary whole-range LanguageID only; no alternate-language or glyph-file assertion.'}
`) + phaseField);
const helpers = lines(`
# Only the reviewed primary LanguageID getter is added to native observations.
function Read-FurnitureProofingLanguage($Range,[string]$Phase,[int]$SlideIndex,[string]$ShapeName,[string]$Prefix) {
    $names=@('OPF heading slides.0.title line 0','OPF list slides.0.items line 0','OPF list slides.0.items line 1')
    if($Phase -cnotin @('original','edited','reopened') -or $SlideIndex -ne 1 -or $names -cnotcontains $ShapeName) { Stop-FurnitureLifecycle 'Proofing observation has an unexpected phase, slide or exact shape name' }
    if(@($report.proofingLanguage.observations | Where-Object {$_.phase -ceq $Phase -and $_.shapeName -ceq $ShapeName}).Count -ne 0) { Stop-FurnitureLifecycle 'Proofing observation repeats an exact phase/name pair' }
    $probe=[ordered]@{phase=$Phase;slideIndex=$SlideIndex;shapeName=$ShapeName;expectedLanguageId=1025;observedLanguageId=$null;status='begin';failure=$null}
    $report.proofingLanguage.observations+=@($probe)
    try {
        $probe.observedLanguageId=Invoke-FurnitureCom "$Prefix.languageId.get" { return ,$Range.LanguageID }
        if(-not(Test-Integer $probe.observedLanguageId) -or $probe.observedLanguageId -ne 1025) {
            $probe.failure='Native primary proofing LanguageID must be exactly 1025 (ar-SA)'
            Stop-FurnitureLifecycle $probe.failure
        }
        $probe.status='uniform-exact'
        return [ordered]@{languageId=$probe.observedLanguageId;status='uniform-exact';api='PowerPoint.TextFrame.TextRange.LanguageID'}
    } catch {
        $probe.status='failed'
        if($null -eq $probe.failure) { $probe.failure=$_.Exception.Message }
        throw
    }
}
function Assert-FurnitureProofingPhase([string]$Phase,[bool]$Complete) {
    $phases=@('original','edited','reopened')
    $count=@($report.proofingLanguage.completedPhases).Count
    if($count -ge 3 -or $phases[$count] -cne $Phase) { Stop-FurnitureLifecycle 'Proofing phases must occur exactly once in original, edited, reopened order' }
    if(-not $Complete) { return }
    $names=@('OPF heading slides.0.title line 0','OPF list slides.0.items line 0','OPF list slides.0.items line 1')
    $observations=@($report.proofingLanguage.observations | Where-Object {$_.phase -ceq $Phase})
    if($observations.Count -ne 3) { Stop-FurnitureLifecycle 'Proofing phase lacks exactly three actual named range observations' }
    foreach($name in $names) {
        $matchingObservations=@($observations | Where-Object {$_.shapeName -ceq $name -and $_.slideIndex -eq 1 -and $_.status -ceq 'uniform-exact' -and (Test-Integer $_.observedLanguageId) -and $_.observedLanguageId -eq 1025})
        if($matchingObservations.Count -ne 1) { Stop-FurnitureLifecycle 'Proofing phase has missing, duplicate, foreign or changed-language observations' }
    }
    $report.proofingLanguage.completedPhases+=@($Phase)
}

`);
result = once(result, 'function Read-FurnitureState($Presentation,[string]$Phase) {', helpers + 'function Read-FurnitureState($Presentation,[string]$Phase) {');
const start = result.indexOf('function Read-FurnitureState('), end = result.indexOf('function Get-ActionTags(', start);
assert(start >= 0 && end > start);
let state = result.slice(start, end);
state = once(state, 'function Read-FurnitureState($Presentation,[string]$Phase) {' + nl, 'function Read-FurnitureState($Presentation,[string]$Phase) {' + nl + '    Assert-FurnitureProofingPhase $Phase $false' + nl);
const slideCap = '    if($slideCount -lt 1 -or $slideCount -gt 3) { throw "Presentation must contain 1 through 3 slides; observed $slideCount" }';
state = once(state, slideCap, slideCap + nl + "    if($slideCount -ne 1) { Stop-FurnitureLifecycle 'Proofing diagnostic requires one observed native slide' }");
state = once(state, '        if($ReadOnlySurvey) {', "        if($shapeCount -ne 3) { Stop-FurnitureLifecycle 'Proofing diagnostic requires exactly three observed top-level shapes' }" + nl + '        if($ReadOnlySurvey) {');
const textLine = '            if($hasTextFrame -ne 0) { $frame=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.textFrame.get" { $shape.TextFrame }; $range=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.textRange.get" { $frame.TextRange }; $text=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.text.get" { $range.Text } }';
state = once(state, textLine, textLine + nl + lines(`            if($hasTextFrame -eq 0 -or $text -isnot [string] -or [string]::IsNullOrEmpty($text)) { Stop-FurnitureLifecycle 'Proofing diagnostic requires a nonempty observed text range on every shape' }
            $proofingLanguage=Read-FurnitureProofingLanguage $range $Phase $slideIndex $name "$Phase.slide-$slideIndex.shape-$shapeIndex"
`).slice(0, -nl.length));
state = once(state, '            if($CaptureTextFonts) {', '            $shapeRecord.textProofingLanguage=$proofingLanguage' + nl + '            if($CaptureTextFonts) {');
state = once(state, '        $png=Join-Path', '        Assert-FurnitureProofingPhase $Phase $true' + nl + '        $png=Join-Path');
result = result.slice(0, start) + state + result.slice(end);
await fs.mkdir(new URL('worker-package/test/', root), {recursive: true});
await fs.writeFile(new URL('worker-package/test/native-furniture-control.ps1', root), result);
console.log(JSON.stringify({baselineSha256: sha(baseline), workerSha256: sha(Buffer.from(result)), bytes: Buffer.byteLength(result), lineEndings: nl === '\r\n' ? 'CRLF' : 'LF', nativeRun: false, nativeAuthorized: false}, null, 2));
