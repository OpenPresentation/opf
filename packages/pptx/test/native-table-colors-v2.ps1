param(
    [Parameter(Mandatory=$true)][string]$Envelope,
    [Parameter(Mandatory=$true)][string]$EnvelopeSha256,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [switch]$Worker
)
$ErrorActionPreference='Stop'
# Separate replacement. The retired native-table-colors.ps1 is never loaded.
function Get-TableHash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Assert-TablePlainPath([string]$Path) {
    $full=[IO.Path]::GetFullPath($Path)
    if($full.StartsWith('\\')) { throw 'Local table paths only' }
    $cursor=$full
    while($cursor) {
        $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Aliased/reparse table path' }
        $parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent
    }
    return $full
}
function Assert-TableArchive([string]$Path) {
    if((Get-Item -LiteralPath $Path).Length -gt 16777216) { throw 'Table archive exceeds 16 MiB' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive=[IO.Compression.ZipFile]::OpenRead($Path)
    try {
        if($archive.Entries.Count -gt 4096) { throw 'Table archive exceeds 4096 entries' }
        $seen=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
        foreach($entry in $archive.Entries) { if(-not $seen.Add($entry.FullName) -or $entry.FullName -match '[\\:]|(^|/)\.\.(/|$)' -or $entry.FullName.StartsWith('/')) { throw 'Duplicate or unsafe table ZIP entry' } }
        $slides=@($archive.Entries | Where-Object {$_.FullName -cmatch '^ppt/slides/slide[1-6]\.xml$'})
        $allSlides=@($archive.Entries | Where-Object {$_.FullName -cmatch '^ppt/slides/slide[0-9]+\.xml$'})
        if($slides.Count -ne 6 -or $allSlides.Count -ne 6) { throw 'Table archive requires exactly six slide parts' }
        foreach($entry in $slides) {
            if($entry.Length -gt 1048576) { throw 'Table slide XML exceeds 1 MiB' }
            $stream=$entry.Open();$reader=$null
            try {
                $settings=New-Object Xml.XmlReaderSettings;$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
                $reader=[Xml.XmlReader]::Create($stream,$settings);$xml=New-Object Xml.XmlDocument;$xml.XmlResolver=$null;$xml.Load($reader)
                $ns=New-Object Xml.XmlNamespaceManager($xml.NameTable);$ns.AddNamespace('a','http://schemas.openxmlformats.org/drawingml/2006/main')
                $tables=$xml.SelectNodes('//a:tbl',$ns)
                if($tables.Count -ne 1 -or $tables[0].SelectNodes('a:tr',$ns).Count -ne 2 -or $tables[0].SelectNodes('a:tblGrid/a:gridCol',$ns).Count -ne 2) { throw 'Table archive requires one two-by-two table per slide' }
                foreach($row in $tables[0].SelectNodes('a:tr',$ns)) { if($row.SelectNodes('a:tc',$ns).Count -ne 2) { throw 'Table row requires two cells' } }
            } finally { if($null -ne $reader) { $reader.Dispose() };$stream.Dispose() }
        }
    } finally { $archive.Dispose() }
}
function Assert-TableWorkerAuthorization($Runner,$Profile,[string]$ExpectedSha256) {
    if($Runner.schemaVersion -ne 2 -or $Runner.profile -cne 'table-colors-v2' -or $Runner.envelopeSha256 -cne $ExpectedSha256 -or $Runner.sourceSuiteSha256 -cne $Profile.suiteSha256 -or $Runner.runOfficeRequested -isnot [bool] -or $Runner.runOfficeRequested -ne $true -or $Runner.status -cne 'native-worker-pending') { throw 'Table worker requires the explicit pending supervisor request' }
    if(($Runner.timeoutSeconds -isnot [int] -and $Runner.timeoutSeconds -isnot [long]) -or $Runner.timeoutSeconds -lt 5 -or $Runner.timeoutSeconds -gt 60) { throw 'Invalid bounded table supervisor timeout' }
    foreach($pair in @(@($Runner.generationIdentity,$Profile.generationIdentity),@($Runner.executionIdentity,$Profile.controller))) {
        if(($pair[0] | ConvertTo-Json -Compress -Depth 100) -cne ($pair[1] | ConvertTo-Json -Compress -Depth 100)) { throw 'Table supervisor identity differs' }
    }
}
function Write-TableStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++
    $script:lastStage=$Name;$script:lastStatus=$Status
    $record=[ordered]@{sequence=$script:sequence;stage=$Name;status=$Status;timestamp=(Get-Date).ToUniversalTime().ToString('o');error=$ErrorMessage;officeOperationsStopped=$script:stopped;cleanupConfirmed=$script:cleanup;ownedPresentationPath=$script:ownedPath}
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath (Join-Path $script:root 'stages.jsonl') -Encoding UTF8
    $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $script:root 'progress.json') -Encoding UTF8
}
function Stop-TableLifecycle([string]$Message) {
    $script:stopped=$true;$script:cleanup=$false
    throw $Message
}
function Assert-TableCondition([bool]$Condition,[string]$Message) { if(-not $Condition) { Stop-TableLifecycle $Message } }
function Invoke-TableCom([string]$Name,[scriptblock]$Operation) {
    if($script:stopped) { throw 'Table Office operations stopped after failure' }
    Write-TableStage $Name 'begin'
    try { $value=& $Operation;Write-TableStage $Name 'success';return ,$value }
    catch { $script:stopped=$true;$script:cleanup=$false;Write-TableStage $Name 'error' $_.Exception.Message;throw }
}
function Assert-TableOfficeIdle { if(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) { Stop-TableLifecycle 'PowerPoint already running; refuse attachment' } }
function New-TableApplication { return Invoke-TableCom 'application.create' { New-Object -ComObject PowerPoint.Application } }
function Own-TableApplication($Application) {
    $count=Invoke-TableCom 'application.initial.count' {$Application.Presentations.Count}
    Assert-TableCondition ($count -eq 0) 'Created application is not empty; refuse ownership'
    $script:app=$Application
}
function Open-TableOwned([string]$Path,[string]$Phase) {
    Assert-TableCondition ($null -ne $script:app -and $null -eq $script:presentation) 'No exclusive application ownership'
    $count=Invoke-TableCom "$Phase.preflight.count" {$script:app.Presentations.Count}
    Assert-TableCondition ($count -eq 0) 'Foreign or already-open presentation; refuse adoption'
    Assert-TableCondition ((Get-TableHash $Path) -ceq $script:archiveHashes[$Path]) 'Owned input archive changed before open'
    $script:cleanup=$false;$script:ownedPath=$Path
    $script:presentation=Invoke-TableCom "$Phase.open" {$script:app.Presentations.Open($Path,-1,0,0)}
    $actual=Invoke-TableCom "$Phase.fullName" {$script:presentation.FullName}
    Assert-TableCondition ([string]::Equals($actual,$Path,[StringComparison]::OrdinalIgnoreCase)) 'Opened table path differs'
    $readonly=Invoke-TableCom "$Phase.readOnly" {$script:presentation.ReadOnly}
    Assert-TableCondition ($readonly -eq -1) 'Table input did not open read-only'
    $script:report.opens+=@([ordered]@{phase=$Phase;path=$actual;readOnly=$readonly;archiveSha256=(Get-TableHash $Path)})
}
function Read-TableObject($Presentation,[int]$Index,[string]$Phase) {
    $slide=Invoke-TableCom "$Phase.slide.$Index.get" {$Presentation.Slides.Item($Index)}
    $count=Invoke-TableCom "$Phase.slide.$Index.shapes" {$slide.Shapes.Count}
    Assert-TableCondition ($count -eq 1) 'Each original table slide must have exactly one shape'
    $shape=Invoke-TableCom "$Phase.slide.$Index.shape" {$slide.Shapes.Item(1)}
    $hasTable=Invoke-TableCom "$Phase.slide.$Index.hasTable" {$shape.HasTable}
    Assert-TableCondition ($hasTable -eq -1) 'Expected one editable native table'
    $table=Invoke-TableCom "$Phase.slide.$Index.table" {$shape.Table}
    $rows=Invoke-TableCom "$Phase.slide.$Index.rows" {$table.Rows.Count};$columns=Invoke-TableCom "$Phase.slide.$Index.columns" {$table.Columns.Count}
    Assert-TableCondition ($rows -eq 2 -and $columns -eq 2) 'Native table dimensions differ'
    return [ordered]@{slide=$slide;table=$table}
}
function Read-TablePhase([string]$Phase) {
    $count=Invoke-TableCom "$Phase.slides.count" {$script:presentation.Slides.Count}
    Assert-TableCondition ($count -eq 6) 'Native table must retain all six slides'
    $observations=@()
    for($index=1;$index -le 6;$index++) {
        $object=Read-TableObject $script:presentation $index $Phase;$slide=$object.slide;$table=$object.table;$cells=@()
        foreach($expected in $script:generation.expected[$index-1].cells) {
            $prefix="$Phase.slide.$index.cell.$($expected.row).$($expected.column)"
            $range=Invoke-TableCom "$prefix.range" {$table.Cell($expected.row,$expected.column).Shape.TextFrame.TextRange}
            $text=Invoke-TableCom "$prefix.text" {$range.Text}
            $wanted=($expected.runs | ForEach-Object {$_.text}) -join ''
            $wantedColors=@($expected.runs | ForEach-Object {$run=$_;for($c=0;$c -lt $run.text.Length;$c++) {$run.color}})
            if($Phase -ceq 'edited' -and $expected.row -eq 2 -and $expected.column -eq 1) { $wanted='Native '+$wanted;$wantedColors=@(1..7 | ForEach-Object {$expected.runs[0].color})+$wantedColors }
            Assert-TableCondition ([string]::Equals($text,$wanted,[StringComparison]::Ordinal)) 'Native table cell text differs'
            $characters=@()
            for($character=1;$character -le $text.Length;$character++) {
                $rgb=Invoke-TableCom "$prefix.character.$character.color" {$range.Characters($character,1).Font.Color.RGB}
                $hex='#{0:X2}{1:X2}{2:X2}' -f ([long]$rgb -band 255),(([long]$rgb -shr 8) -band 255),(([long]$rgb -shr 16) -band 255)
                Assert-TableCondition ($hex -ceq $wantedColors[$character-1]) 'Native table character color differs'
                $characters+=@([ordered]@{character=$text.Substring($character-1,1);color=$hex})
            }
            $cells+=@([ordered]@{row=$expected.row;column=$expected.column;text=$text;characters=$characters})
        }
        $png="$Phase-$index.png";$pngPath=Join-Path $script:root $png
        Assert-TableCondition (-not (Test-Path -LiteralPath $pngPath)) 'Preserve an existing table capture'
        Invoke-TableCom "$Phase.slide.$index.capture" {$slide.Export($pngPath,'PNG',1280,720)}
        $observations+=@([ordered]@{slide=$index;cells=$cells;png=$png;pngSha256=(Get-TableHash $pngPath)})
    }
    return ,$observations
}
function Edit-TablePrefixes {
    for($index=1;$index -le 6;$index++) {
        $object=Read-TableObject $script:presentation $index 'edit';$table=$object.table
        $range=Invoke-TableCom "edit.slide.$index.range" {$table.Cell(2,1).Shape.TextFrame.TextRange}
        $before=Invoke-TableCom "edit.slide.$index.before" {$range.Text}
        $wanted=($script:generation.expected[$index-1].cells | Where-Object {$_.row -eq 2 -and $_.column -eq 1}).runs.text -join ''
        Assert-TableCondition ([string]::Equals($before,$wanted,[StringComparison]::Ordinal)) 'Prefix target was not the expected original cell'
        Invoke-TableCom "edit.slide.$index.prefix" {$range.Text='Native '+$before}
        $after=Invoke-TableCom "edit.slide.$index.after" {$range.Text}
        Assert-TableCondition ([string]::Equals($after,('Native '+$wanted),[StringComparison]::Ordinal)) 'Actual native prefix edit failed'
        $script:report.edits+=@([ordered]@{slide=$index;row=2;column=1;before=$before;after=$after;prefix='Native '})
    }
}
function Save-TableCopy([string]$Expected,[string]$Target,[string]$Phase) {
    Assert-TableCondition ($Expected -ine $Target -and -not (Test-Path -LiteralPath $Target)) 'SaveCopyAs needs a fresh derivative'
    $actual=Invoke-TableCom "$Phase.save.fullName" {$script:presentation.FullName}
    Assert-TableCondition ($actual -ieq $Expected -and $script:ownedPath -ieq $Expected) 'Refuse SaveCopyAs on unowned presentation'
    Invoke-TableCom "$Phase.saveCopyAs" {$script:presentation.SaveCopyAs($Target,24)}
    $actual=Invoke-TableCom "$Phase.save.afterName" {$script:presentation.FullName}
    Assert-TableCondition ($actual -ieq $Expected) 'SaveCopyAs changed input identity'
    Assert-TableArchive $Target
    $script:archiveHashes[$Target]=Get-TableHash $Target
}
function Close-TableOwned([string]$Expected,[string]$Phase) {
    $actual=Invoke-TableCom "$Phase.close.fullName" {$script:presentation.FullName}
    Assert-TableCondition ($actual -ieq $Expected -and $script:ownedPath -ieq $Expected) 'Refuse close on unowned presentation'
    Invoke-TableCom "$Phase.close.discard" {$script:presentation.Saved=-1}
    Invoke-TableCom "$Phase.close" {$script:presentation.Close()}
    $script:presentation=$null;$script:ownedPath=$null
}
function Quit-TableOwned {
    $count=Invoke-TableCom 'application.final.count' {$script:app.Presentations.Count}
    Assert-TableCondition ($count -eq 0) 'Refuse quit with foreign presentations'
    Invoke-TableCom 'application.quit' {$script:app.Quit()}
    $script:app=$null;$script:cleanup=$true
}
function Invoke-TableLifecycle {
    Assert-TableOfficeIdle
    $application=New-TableApplication;Own-TableApplication $application
    Open-TableOwned $script:sourcePath 'original'
    $script:report.original=Read-TablePhase 'original'
    Save-TableCopy $script:sourcePath $script:savedPath 'original'
    Close-TableOwned $script:sourcePath 'original'
    Open-TableOwned $script:savedPath 'reopened'
    $script:report.reopened=Read-TablePhase 'reopened'
    Edit-TablePrefixes
    Save-TableCopy $script:savedPath $script:editedPath 'edited'
    Close-TableOwned $script:savedPath 'reopened'
    Open-TableOwned $script:editedPath 'edited'
    $script:report.edited=Read-TablePhase 'edited'
    Close-TableOwned $script:editedPath 'edited'
    Quit-TableOwned
}
if(-not $Worker) { throw 'Only the reviewed table-profile supervisor may launch this worker' }
$script:root=Assert-TablePlainPath $OutputDirectory
$profileFile=Assert-TablePlainPath $Envelope
if($EnvelopeSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-TableHash $profileFile) -cne $EnvelopeSha256) { throw 'Externally pinned table envelope hash differs' }
$profile=Get-Content -LiteralPath $profileFile -Raw -Encoding UTF8 | ConvertFrom-Json
if($profile.schemaVersion -ne 1 -or $profile.profile -cne 'table-colors-v2' -or $script:root -ine (Join-Path $profile.output 'table-colors') -or $profileFile -ine (Join-Path $profile.output 'table-profile.json')) { throw 'Table profile/root differs' }
foreach($record in $profile.snapshots) {
    if($record.path -isnot [string] -or $record.path -match '[\\:]|(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($record.path)) { throw 'Unsafe table snapshot path' }
    $file=Assert-TablePlainPath (Join-Path $profile.output $record.path)
    if((Get-Item -LiteralPath $file).Length -ne $record.bytes -or (Get-TableHash $file) -cne $record.sha256) { throw 'Table snapshot changed' }
}
if([IO.Path]::GetFullPath($PSCommandPath) -ine (Join-Path $profile.output 'inputs/native-table-colors-v2.ps1') -or (Get-TableHash $PSCommandPath) -cne ($profile.snapshots | Where-Object {$_.path -ceq 'inputs/native-table-colors-v2.ps1'}).sha256) { throw 'Executing worker differs from the bound snapshot' }
$authorization=Get-Content -LiteralPath (Join-Path $profile.output 'runner.json') -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-TableWorkerAuthorization $authorization $profile $EnvelopeSha256
$script:sourcePath=Assert-TablePlainPath (Join-Path $script:root 'table-colors.pptx');$script:savedPath=Join-Path $script:root 'table-colors-saved.pptx';$script:editedPath=Join-Path $script:root 'table-colors-edited.pptx'
$generationPath=Join-Path $script:root 'generation.json';$script:generation=Get-Content -LiteralPath $generationPath -Raw -Encoding UTF8 | ConvertFrom-Json
if($script:generation.expected.Count -ne 6 -or $script:generation.pptxSha256 -cne (Get-TableHash $script:sourcePath)) { throw 'Table generation contract differs' }
foreach($relative in @('native.json','failure.json','stages.jsonl','progress.json','table-colors-saved.pptx','table-colors-edited.pptx')) { if(Test-Path -LiteralPath (Join-Path $script:root $relative)) { throw 'Preserve stale table worker output' } }
Assert-TableArchive $script:sourcePath
$script:sequence=0;$script:stopped=$false;$script:cleanup=$true;$script:ownedPath=$null;$script:presentation=$null;$script:app=$null;$script:archiveHashes=@{};$script:archiveHashes[$script:sourcePath]=Get-TableHash $script:sourcePath
$script:report=[ordered]@{schemaVersion=2;profile='table-colors-v2';envelopeSha256=$EnvelopeSha256;generationSha256=(Get-TableHash $generationPath);generationIdentity=$profile.generationIdentity;executionIdentity=$profile.controller;savedSha256=$null;editedSha256=$null;original=@();reopened=@();edited=@();edits=@();opens=@();inputs=[ordered]@{sourcePath=$script:sourcePath;sourceSha256=(Get-TableHash $script:sourcePath);generationPath=$generationPath;workerPath=$PSCommandPath;workerSha256=(Get-TableHash $PSCommandPath);envelopePath=$profileFile};nativeAcceptance=$false;registryAcceptance=$false}
try {
    Write-TableStage 'worker.initialize' 'success'
    Invoke-TableLifecycle
    $script:report.savedSha256=Get-TableHash $script:savedPath;$script:report.editedSha256=Get-TableHash $script:editedPath
    if((Get-TableHash $script:sourcePath) -cne $script:generation.pptxSha256 -or (Get-TableHash $Envelope) -cne $EnvelopeSha256) { Stop-TableLifecycle 'Original input or envelope changed during native lifecycle' }
    Write-TableStage 'worker.complete' 'success'
    $script:report.cleanupConfirmed=$script:cleanup;$script:report.officeOperationsStopped=$script:stopped
    $bytes=[Text.Encoding]::UTF8.GetBytes(($script:report | ConvertTo-Json -Depth 60));$stream=[IO.File]::Open((Join-Path $script:root 'native.json'),[IO.FileMode]::CreateNew);try {$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose()}
} catch {
    $script:stopped=$true;$script:cleanup=$false
    Write-TableStage 'worker.failure' 'error' $_.Exception.Message
    [ordered]@{error=$_.Exception.Message;lastStage=$script:lastStage;cleanupConfirmed=$false;officeOperationsStopped=$true;partial=$script:report} | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath (Join-Path $script:root 'failure.json') -Encoding UTF8
    throw
}
# Deliberately no finally/cleanup Office calls after a failure.
