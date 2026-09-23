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
    $presentations=[pscustomobject]@{Count=$already.Count;MockAlreadyOpen=$already;MockFonts=$fonts;MockMaster=$master;MockSlides=$slides;MockWrongFullName=($variant -ceq 'wrongfullname')}
    $presentations | Add-Member -MemberType ScriptMethod -Name Item -Value { param($Index) if([int]$Index -lt 1 -or [int]$Index -gt $this.MockAlreadyOpen.Count) { throw 'Mock presentation index out of range' }; return ,$this.MockAlreadyOpen[[int]$Index-1] }
    $presentations | Add-Member -MemberType ScriptMethod -Name Open -Value {
        param($FileName,$ReadOnly,$Untitled,$WithWindow)
        $fullName=$(if($this.MockWrongFullName){[string]$FileName + '.other.pptx'}else{[string]$FileName})
        $opened=[pscustomobject]@{FullName=$fullName;ReadOnly=[int]$ReadOnly;Fonts=$this.MockFonts;SlideMaster=$this.MockMaster;Slides=$this.MockSlides;MockClosed=$false}
        $opened | Add-Member -MemberType ScriptMethod -Name Close -Value { $this.MockClosed=$true }
        return ,$opened
    }
    return ,([pscustomobject]@{Version='16.0 (offline mock)';Presentations=$presentations})
}
