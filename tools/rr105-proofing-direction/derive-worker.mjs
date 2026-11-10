// NEVERMERGE diagnostic. Mechanical extension of reviewed b846; no Office is run here.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const here=new URL('./',import.meta.url);
export const sha=b=>createHash('sha256').update(b).digest('hex');
export function derive(baseline){
 assert.equal(sha(baseline),'26ea8b008cdacebc937decbfe52356ace0a146af0d5ade54e20de6397596415c');
 const original=baseline.toString('utf8'),nl=original.includes('\r\n')?'\r\n':'\n';
 const lines=s=>s.replaceAll('\r\n','\n').replaceAll('\n',nl);
 const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'Unique derivation anchor: '+a.slice(0,70));return s.replace(a,()=>b)};
 let result=once(original,"$allowed=@('4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2','2d83ede6179333d73994af25e633129de05c44441ec3b0b570c19aa718152ad5','60fe2d29b96d30be594c115fd84332b0f5a14ac882f25d6ea8dcbbc655e3a5e4')","$allowed=@('4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2')");
 result=once(result,'not one of the three sealed A/B/C inputs','not the exact sealed original09 input');
 const field='    phases=[ordered]@{original=$null;edited=$null;reopened=$null}';
 result=once(result,field,"    paragraphDirection=[ordered]@{api='PowerPoint.TextFrame.TextRange.ParagraphFormat.TextDirection';observations=@();completedPhases=@();diagnosticOnly=$true;nativeAcceptance=$false}"+nl+field);
 const helpers=lines(`
# Diagnostic getter only. Expected XML direction is context, never an acceptance assertion.
function Read-FurnitureParagraphDirection($Range,[string]$Text,[string]$Phase,[int]$SlideIndex,[string]$ShapeName,[string]$Prefix) {
    $names=@('OPF heading slides.0.title line 0','OPF list slides.0.items line 0','OPF list slides.0.items line 1')
    $words=@('نص لاتيني بلغة عربية صريحة','Item 1: Customers told us onboarding took too long, so we rebuilt it ','around the customer journey.')
    $index=[Array]::IndexOf($names,$ShapeName)
    if($Phase -cnotin @('original','edited','reopened') -or $SlideIndex -ne 1 -or $index -lt 0 -or $names[$index] -cne $ShapeName -or $Prefix -cne ($Phase+'.slide-1.shape-'+($index+1))) { Stop-FurnitureLifecycle 'Direction diagnostic requires the exact phase/slide/name/prefix binding' }
    if(-not [string]::Equals($Text,$words[$index],[StringComparison]::Ordinal) -or $Text -match '[\\r\\n\\v]') { Stop-FurnitureLifecycle 'Direction diagnostic requires the exact original09 single-paragraph UTF16 text' }
    if(@($report.paragraphDirection.observations | Where-Object {$_.phase -ceq $Phase -and $_.shapeName -ceq $ShapeName}).Count -ne 0) { Stop-FurnitureLifecycle 'Direction diagnostic repeats a phase/name pair' }
    $expected=if($index -eq 0){2}else{1}
    $probe=[ordered]@{phase=$Phase;slideIndex=1;shapeName=$ShapeName;prefix=$Prefix;sourceUtf16=$Text;expectedXmlDirection=$expected;observedValue=$null;valueKind='unread';classification='pending';status='begin';failure=$null}
    $report.paragraphDirection.observations+=@($probe)
    try {
        Write-FurnitureReport
        $paragraph=Read-FurnitureProperty $Range 'ParagraphFormat' "$Prefix.paragraphFormat.get"
        if($null -eq $paragraph) { Stop-FurnitureLifecycle 'ParagraphFormat getter is unavailable' }
        $value=Read-FurnitureProperty $paragraph 'TextDirection' "$Prefix.paragraphFormat.textDirection.get"
        # Retain only bounded primitives, never a live COM object, before any value classification.
        if($null -eq $value){$probe.valueKind='null'}
        elseif(Test-Integer $value){$probe.valueKind='integer';$probe.observedValue=$value}
        elseif($value -is [string]){$probe.valueKind='string';if($value.Length -le 256){$probe.observedValue=$value}}
        elseif($value -is [bool]){$probe.valueKind='boolean';$probe.observedValue=$value}
        elseif($value -is [single] -or $value -is [double] -or $value -is [decimal]){$probe.valueKind='number';if(-not [double]::IsNaN([double]$value) -and -not [double]::IsInfinity([double]$value)){$probe.observedValue=$value}}
        else{$probe.valueKind='nonprimitive'}
        Write-FurnitureReport
        if(-not(Test-Integer $value) -or $value -notin @(1,2,-2)) { Stop-FurnitureLifecycle 'TextDirection getter is unavailable or outside the documented primitive enum' }
        $probe.classification=if($value -eq -2){'mixed'}elseif($value -eq $expected){'matches-xml'}else{'differs-xml'}
        $probe.status='observed'
        Write-FurnitureReport
        return [ordered]@{value=$value;expectedXmlDirection=$expected;classification=$probe.classification;diagnosticOnly=$true}
    } catch {
        $probe.status='failed';$probe.failure=$_.Exception.Message
        $script:officeOperationsStopped=$true;$script:cleanupConfirmed=$false
        Write-FurnitureReport
        throw
    }
}
function Assert-FurnitureDirectionPhase([string]$Phase,[bool]$Complete) {
    $phases=@('original','edited','reopened');$count=@($report.paragraphDirection.completedPhases).Count
    if($count -ge 3 -or $phases[$count] -cne $Phase) { Stop-FurnitureLifecycle 'Direction phases must be exactly original, edited, reopened' }
    if(-not $Complete){return}
    $names=@('OPF heading slides.0.title line 0','OPF list slides.0.items line 0','OPF list slides.0.items line 1')
    $items=@($report.paragraphDirection.observations | Where-Object {$_.phase -ceq $Phase})
    if($items.Count -ne 3) { Stop-FurnitureLifecycle 'Direction phase requires exactly three observations' }
    for($index=0;$index -lt 3;$index++) {
        $matched=@($items | Where-Object {$_.shapeName -ceq $names[$index] -and $_.prefix -ceq ($Phase+'.slide-1.shape-'+($index+1)) -and $_.slideIndex -eq 1 -and $_.status -ceq 'observed' -and $_.valueKind -ceq 'integer' -and (Test-Integer $_.observedValue) -and $_.observedValue -in @(1,2,-2)})
        if($matched.Count -ne 1) { Stop-FurnitureLifecycle 'Direction phase contains missing, duplicate, foreign or incomplete observations' }
    }
    $report.paragraphDirection.completedPhases+=@($Phase)
}

`);
 const start='function Read-FurnitureState($Presentation,[string]$Phase) {';
 result=once(result,start,helpers+start);
 result=once(result,'    Assert-FurnitureProofingPhase $Phase $false','    Assert-FurnitureProofingPhase $Phase $false'+nl+'    Assert-FurnitureDirectionPhase $Phase $false');
 const probe='            $proofingLanguage=Read-FurnitureProofingLanguage $range $Phase $slideIndex $name "$Phase.slide-$slideIndex.shape-$shapeIndex"';
 result=once(result,probe,probe+nl+'            $paragraphDirection=Read-FurnitureParagraphDirection $range $text $Phase $slideIndex $name "$Phase.slide-$slideIndex.shape-$shapeIndex"');
 result=once(result,'            $shapeRecord.textProofingLanguage=$proofingLanguage','            $shapeRecord.textProofingLanguage=$proofingLanguage'+nl+'            $shapeRecord.paragraphDirection=$paragraphDirection');
 result=once(result,'        Assert-FurnitureProofingPhase $Phase $true','        Assert-FurnitureProofingPhase $Phase $true'+nl+'        Assert-FurnitureDirectionPhase $Phase $true');
 return Buffer.from(result);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const baseline=gunzipSync(readFileSync(new URL('reference-worker.ps1.gz',here))),result=derive(baseline);
 if(process.argv[2]==='--write'&&process.argv.length===3){const output=new URL('worker-package/test/native-furniture-control.ps1',here);assert.equal(existsSync(output),false);mkdirSync(new URL('worker-package/test/',here),{recursive:true});writeFileSync(output,result,{flag:'wx'});}
 else assert.equal(process.argv.length,2,'Use only --write to create the new source file');
 console.log(JSON.stringify({baselineSha256:sha(baseline),workerSha256:sha(result),bytes:result.length,officeRun:false,nativeAcceptance:false},null,2));
}