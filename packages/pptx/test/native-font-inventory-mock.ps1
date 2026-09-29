# Offline stand-in for the PowerPoint object model, used only by
# native-font-inventory-controls.mjs. The controls dot-source this file into a
# temporary copy of the inventory worker whose single ComObject construction is
# replaced by New-OpfInventoryMockApplication. Nothing here starts Office, COM,
# or a font API. The optional OPF_INVENTORY_MOCK_VARIANT environment variable
# selects a scenario:
#   carlito (default)  Carlito-only names
#   aptos              Aptos in Presentation.Fonts and one master slot
#   cloud              an unrelated cloud deck with a URL FullName is already open
#   badcount           Fonts.Count is not numeric: non-COM failure while open
#   comerror           Fonts.Item throws: COM failure while open (latched)
#   wrongfullname      the opened object reports a different FullName
#   masters-all-true   Has{Handout,Notes,Title}Master all -1 (default: 0, -1, 0)
#   masters-domain     HasNotesMaster returns 1, outside the msoTriState -1/0 domain
#   masters-{null,empty-string,fraction,bool,string,double-zero}  HasNotesMaster returns $null, '', 0.5, $true, '0', [double]0
#                      (each must be recorded raw with its type and fail, never coerced to 0)
#   masters-int16      HasNotesMaster returns [int16]-1 (an integral COM type, accepted)
#   masters-{handout,notes,title}-error  that getter fails (wrapper-injected, latched);
#                      a dual- prefix combines it with the dual-* font scenarios
# The HandoutMaster, NotesMaster and TitleMaster objects are tripwires: any access
# appends its name to the file named by OPF_INVENTORY_MOCK_MASTER_LOG.
# Second-read terminating failures use a hook inserted only in the controls'
# temporary worker copy: PS ScriptProperty getter exceptions can be swallowed
# by property access, so they cannot faithfully stand in for terminating COM.
# The construction mock is dot-sourced inside an Operation child scope;
# keep this later-stage hook visible to the temporary worker script.
function script:Invoke-OpfInventoryMockFault([string]$StageName) {
    $suffix=([string]$env:OPF_INVENTORY_MOCK_VARIANT) -replace '^dual-','' -replace '-error$',''
    $target=$(switch($suffix) {
        'get' {'owned.presentation.fonts-after-content.get'}
        'count' {'owned.presentation.fonts-after-content.count.get'}
        'item' {'owned.presentation.fonts-after-content.item-2.get'}
        'name' {'owned.presentation.fonts-after-content.item-2.name.get'}
        'embedded' {'owned.presentation.fonts-after-content.item-2.embedded.get'}
        'embeddable' {'owned.presentation.fonts-after-content.item-2.embeddable.get'}
        default {$null}
    })
    if($null -ne $target -and $StageName -ceq $target) { throw "Mock terminating getter failure at $StageName" }
    if(([string]$env:OPF_INVENTORY_MOCK_VARIANT) -match '^(?:dual-)?masters-(handout|notes|title)-error$') {
        $masterTarget=$(switch($Matches[1]) { 'handout' {'owned.presentation.hasHandoutMaster.get'} 'notes' {'owned.presentation.hasNotesMaster.get'} 'title' {'owned.presentation.hasTitleMaster.get'} })
        if($StageName -ceq $masterTarget) { throw "Mock terminating getter failure at $StageName" }
    }
}
function New-OpfInventoryMockCollection($Items) {
    $collection=[pscustomobject]@{Count=@($Items).Count;MockItems=@($Items)}
    $collection | Add-Member -MemberType ScriptMethod -Name Item -Value { param($Index) return ,$this.MockItems[[int]$Index-1] }
    return ,$collection
}
function New-OpfInventoryMockFont([string]$Name,[string]$FarEast,[string]$ComplexScript,[double]$Size,[int]$Bold,[int]$Italic) {
    return ,([pscustomobject]@{Name=$Name;NameAscii=$Name;NameOther=$Name;NameFarEast=$FarEast;NameComplexScript=$ComplexScript;Size=$Size;Bold=$Bold;Italic=$Italic})
}
function New-OpfInventoryMockRange([string]$Text,[int]$Start,$Font,$Paragraphs,$Runs) {
    $range=[pscustomobject]@{Text=$Text;Start=$Start;Length=$Text.Length;Font=$Font;MockParagraphs=@($Paragraphs);MockRuns=@($Runs)}
    $range | Add-Member -MemberType ScriptMethod -Name Paragraphs -Value { param($Index,$Length) if($null -eq $Index) { return ,([pscustomobject]@{Count=$this.MockParagraphs.Count}) }; return ,$this.MockParagraphs[[int]$Index-1] }
    $range | Add-Member -MemberType ScriptMethod -Name Runs -Value { param($Index,$Length) if($null -eq $Index) { return ,([pscustomobject]@{Count=$this.MockRuns.Count}) }; return ,$this.MockRuns[[int]$Index-1] }
    return ,$range
}
function New-OpfInventoryMockTextShape([string]$Name,[object[]]$Segments,[string]$Family,[string]$FarEast) {
    $runs=@(); $start=1; $text=''
    foreach($segment in $Segments) {
        $font=New-OpfInventoryMockFont $Family $FarEast '' ([double]$segment[1]) ([int]$segment[2]) ([int]$segment[3])
        $runs+=@(New-OpfInventoryMockRange ([string]$segment[0]) $start $font @() @())
        $start+=([string]$segment[0]).Length; $text+=[string]$segment[0]
    }
    $whole=New-OpfInventoryMockFont $Family $FarEast '' 18 0 0
    $paragraph=New-OpfInventoryMockRange $text 1 $whole @() @()
    $range=New-OpfInventoryMockRange $text 1 $whole @($paragraph) $runs
    return ,([pscustomobject]@{Name=$Name;Type=14;HasTextFrame=-1;TextFrame2=[pscustomobject]@{HasText=-1;TextRange=$range}})
}
function New-OpfInventoryMockEmptyShape([string]$Name,[string]$Family,[string]$ComplexScript) {
    $range=New-OpfInventoryMockRange '' 1 (New-OpfInventoryMockFont $Family '' $ComplexScript 18 0 0) @() @()
    return ,([pscustomobject]@{Name=$Name;Type=14;HasTextFrame=-1;TextFrame2=[pscustomobject]@{HasText=0;TextRange=$range}})
}
function New-OpfInventoryMockApplication {
    $variant=[string]$env:OPF_INVENTORY_MOCK_VARIANT
    $aptos=($variant -ceq 'aptos')
    $fontNames=$(if($aptos){@('Carlito','Aptos')}else{@('Carlito')})
    $fonts=New-OpfInventoryMockCollection @($fontNames | ForEach-Object { [pscustomobject]@{Name=$_;Embedded=0;Embeddable=-1} })
    $afterFonts=$fonts
    if($variant.StartsWith('dual-')) {
        $beforeNames=@('Carlito'); $afterNames=@('Carlito')
        switch($variant) {
            'dual-changed' {$afterNames=@('','Aptos')}
            'dual-reordered' {$beforeNames=@('','Carlito','Carlito','Aptos');$afterNames=@('Aptos','Carlito','','Carlito')}
            'dual-soft-hyphen' {$beforeNames=@('AB');$afterNames=@('A'+[char]0x00ad+'B')}
            'dual-composed' {$beforeNames=@([string][char]0x00e9);$afterNames=@('e'+[char]0x0301)}
            'dual-empty-ignorable' {$beforeNames=@('');$afterNames=@([string][char]0x00ad)}
            'dual-overflow' {$afterNames=@(1..65 | ForEach-Object {'Carlito'})}
            'dual-cleared' {$afterNames=@()}
            'dual-empty-both' {$beforeNames=@();$afterNames=@()}
        }
        if($variant -match '^dual-(item|name|embedded|embeddable)-error$') {$afterNames=@('Carlito','Aptos')}
        $fonts=New-OpfInventoryMockCollection @($beforeNames | ForEach-Object {[pscustomobject]@{Name=$_;Embedded=0;Embeddable=$(if($_ -ceq ''){0}else{-1})}})
        $afterFonts=New-OpfInventoryMockCollection @($afterNames | ForEach-Object {[pscustomobject]@{Name=$_;Embedded=0;Embeddable=$(if([string]::Equals($_,'',[StringComparison]::Ordinal)){0}else{-1})}})
        if($variant -ceq 'dual-flags') {$afterFonts.MockItems[0].Embedded=-1}
    }
    if($variant -ceq 'badcount') { $fonts.Count='not-a-number' }
    if($variant -ceq 'comerror') { $fonts | Add-Member -MemberType ScriptMethod -Name Item -Value { param($Index) throw 'Mock COM failure reading Presentation.Fonts' } -Force }
    $themeFont={ param($Latin) New-OpfInventoryMockCollection @([pscustomobject]@{Name=$Latin},[pscustomobject]@{Name=''},[pscustomobject]@{Name=''}) }
    $scheme=[pscustomobject]@{MajorFont=(& $themeFont 'Carlito');MinorFont=(& $themeFont 'Carlito')}
    $masterShapes=New-OpfInventoryMockCollection @(
        (New-OpfInventoryMockEmptyShape 'Title Placeholder 1' 'Carlito' ''),
        (New-OpfInventoryMockEmptyShape 'Text Placeholder 2' 'Carlito' $(if($aptos){'Aptos'}else{''}))
    )
    $master=[pscustomobject]@{Theme=[pscustomobject]@{ThemeFontScheme=$scheme};Shapes=$masterShapes}
    $slideShapes=New-OpfInventoryMockCollection @(
        (New-OpfInventoryMockTextShape 'OPF heading slides.0.title line 0' @(,@('Gate E fixture',30,-1,0)) 'Carlito' 'Carlito'),
        (New-OpfInventoryMockTextShape 'OPF text slides.0.text line 0' @(@('Regular ',18,0,0),@('Bold ',20,-1,0),@('Italic ',22,0,-1),@('BoldItalic',24,-1,-1)) 'Carlito' $(if($aptos){''}else{'Carlito'}))
    )
    $slides=New-OpfInventoryMockCollection @([pscustomobject]@{Shapes=$slideShapes})
    $already=@(if($variant -ceq 'cloud'){[pscustomobject]@{FullName='https://contoso.sharepoint.com/sites/team/Shared%20Documents/cloud-deck.pptx'}})
    $presence=@{Handout=0;Notes=-1;Title=0}
    if($variant -ceq 'masters-all-true') { $presence=@{Handout=-1;Notes=-1;Title=-1} }
    switch -CaseSensitive ($variant) {
        'masters-domain' { $presence.Notes=1 }
        'masters-null' { $presence.Notes=$null }
        'masters-empty-string' { $presence.Notes='' }
        'masters-fraction' { $presence.Notes=0.5 }
        'masters-bool' { $presence.Notes=$true }
        'masters-string' { $presence.Notes='0' }
        'masters-double-zero' { $presence.Notes=[double]0 }
        'masters-int16' { $presence.Notes=[int16](-1) }
    }
    $presentations=[pscustomobject]@{MockPresence=$presence;Count=$already.Count;MockAlreadyOpen=$already;MockFonts=$fonts;MockAfterFonts=$afterFonts;MockVariant=$variant;MockMaster=$master;MockSlides=$slides;MockWrongFullName=($variant -ceq 'wrongfullname')}
    $presentations | Add-Member -MemberType ScriptMethod -Name Item -Value { param($Index) if([int]$Index -lt 1 -or [int]$Index -gt $this.MockAlreadyOpen.Count) { throw 'Mock presentation index out of range' }; return ,$this.MockAlreadyOpen[[int]$Index-1] }
    $presentations | Add-Member -MemberType ScriptMethod -Name Open -Value {
        param($FileName,$ReadOnly,$Untitled,$WithWindow)
        $fullName=$(if($this.MockWrongFullName){[string]$FileName + '.other.pptx'}else{[string]$FileName})
        $opened=[pscustomobject]@{HasHandoutMaster=$this.MockPresence.Handout;HasNotesMaster=$this.MockPresence.Notes;HasTitleMaster=$this.MockPresence.Title;FullName=$fullName;ReadOnly=[int]$ReadOnly;Fonts=$this.MockFonts;SlideMaster=$this.MockMaster;Slides=$this.MockSlides;MockClosed=$false}
        if($this.MockVariant.StartsWith('dual-')) {
            $opened | Add-Member NoteProperty MockFirstFonts $this.MockFonts
            $opened | Add-Member NoteProperty MockAfterFonts $this.MockAfterFonts
            $opened | Add-Member NoteProperty MockFontsReads 0
            $opened | Add-Member NoteProperty MockVariant $this.MockVariant
            $opened | Add-Member ScriptProperty Fonts {
                $this.MockFontsReads++
                if($this.MockFontsReads -eq 1){return ,$this.MockFirstFonts}
                if($this.MockFontsReads -ne 2){throw 'Mock refuses a third Fonts read'}
                if($this.MockVariant -ceq 'dual-wrongfullname'){$this.FullName+=' .not-owned'}
                return ,$this.MockAfterFonts
            } -Force
            if($this.MockVariant -ceq 'dual-writable'){$opened.ReadOnly=0}
        }
        # Tripwires: reading a master object can create a master, so the worker must never do it.
        $opened | Add-Member -MemberType ScriptProperty -Name HandoutMaster -Value { if($env:OPF_INVENTORY_MOCK_MASTER_LOG) { Add-Content -LiteralPath $env:OPF_INVENTORY_MOCK_MASTER_LOG -Value 'HandoutMaster' }; return $null }
        $opened | Add-Member -MemberType ScriptProperty -Name NotesMaster -Value { if($env:OPF_INVENTORY_MOCK_MASTER_LOG) { Add-Content -LiteralPath $env:OPF_INVENTORY_MOCK_MASTER_LOG -Value 'NotesMaster' }; return $null }
        $opened | Add-Member -MemberType ScriptProperty -Name TitleMaster -Value { if($env:OPF_INVENTORY_MOCK_MASTER_LOG) { Add-Content -LiteralPath $env:OPF_INVENTORY_MOCK_MASTER_LOG -Value 'TitleMaster' }; return $null }
        $opened | Add-Member -MemberType ScriptMethod -Name Close -Value { $this.MockClosed=$true }
        return ,$opened
    }
    return ,([pscustomobject]@{Version='16.0 (offline mock)';Presentations=$presentations})
}
