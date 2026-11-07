# OPF-authored SmartArt parts, written from scratch (no PowerPoint layout definition content).
. "$PSScriptRoot\zip.ps1"
$NsDgm = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
$NsA = 'http://schemas.openxmlformats.org/drawingml/2006/main'
$NsDsp = 'http://schemas.microsoft.com/office/drawing/2008/diagram'
$QsSimple = 'urn:microsoft.com/office/officeart/2005/8/quickstyle/simple1'
$CsAccent1 = 'urn:microsoft.com/office/officeart/2005/8/colors/accent1_2'

function G { '{' + ([guid]::NewGuid().ToString().ToUpper()) + '}' }
function Esc([string]$s) { [Security.SecurityElement]::Escape($s) }

# $nodes: array of @{ t = 'text'; p = parentIndex (-1 = doc) }
function New-DataXml([string]$loId, $nodes, [string]$drawingRelId, [string]$qsId = $QsSimple, [string]$csId = $CsAccent1) {
  $doc = G
  $ids = @(); foreach ($n in $nodes) { $ids += (G) }
  $pts = New-Object Text.StringBuilder; $cx = New-Object Text.StringBuilder
  [void]$pts.Append("<dgm:pt modelId=`"$doc`" type=`"doc`"><dgm:prSet loTypeId=`"$loId`" loCatId=`"`" qsTypeId=`"$qsId`" qsCatId=`"simple`" csTypeId=`"$csId`" csCatId=`"accent1`"/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang=`"en-US`"/></a:p></dgm:t></dgm:pt>")
  $ord = @{}
  for ($i = 0; $i -lt $nodes.Count; $i++) {
    $n = $nodes[$i]; $id = $ids[$i]; $par = if ($n.p -lt 0) { $doc } else { $ids[$n.p] }
    if (-not $ord.ContainsKey($par)) { $ord[$par] = 0 }
    $c = G; $pt = G; $st = G
    [void]$pts.Append("<dgm:pt modelId=`"$id`"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang=`"en-US`"/><a:t>$(Esc $n.t)</a:t></a:r></a:p></dgm:t></dgm:pt>")
    [void]$pts.Append("<dgm:pt modelId=`"$pt`" type=`"parTrans`" cxnId=`"$c`"><dgm:prSet/><dgm:spPr/></dgm:pt><dgm:pt modelId=`"$st`" type=`"sibTrans`" cxnId=`"$c`"><dgm:prSet/><dgm:spPr/></dgm:pt>")
    [void]$cx.Append("<dgm:cxn modelId=`"$c`" srcId=`"$par`" destId=`"$id`" srcOrd=`"$($ord[$par])`" destOrd=`"0`" parTransId=`"$pt`" sibTransId=`"$st`"/>")
    $ord[$par]++
  }
  $ext = ''
  if ($drawingRelId) { $ext = "<dgm:extLst><a:ext uri=`"http://schemas.microsoft.com/office/drawing/2008/diagram`"><dsp:dataModelExt xmlns:dsp=`"$NsDsp`" relId=`"$drawingRelId`" minVer=`"http://schemas.openxmlformats.org/drawingml/2006/diagram`"/></a:ext></dgm:extLst>" }
  $xml = "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><dgm:dataModel xmlns:dgm=`"$NsDgm`" xmlns:a=`"$NsA`"><dgm:ptLst>$pts</dgm:ptLst><dgm:cxnLst>$cx</dgm:cxnLst><dgm:bg/><dgm:whole/>$ext</dgm:dataModel>"
  return @{ xml = $xml; ids = $ids }
}

# kind: 'empty' (uniqueId only) | 'min' (one empty layoutNode)
function New-LayoutXml([string]$uniqueId, [string]$kind = 'min') {
  if ($kind -eq 'opfrow') { return (New-OpfRowLayoutXml $uniqueId) }
  $body = if ($kind -eq 'empty') { '' } else { '<dgm:title val=""/><dgm:desc val=""/><dgm:layoutNode name="root"/>' }
  return "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><dgm:layoutDef xmlns:dgm=`"$NsDgm`" xmlns:a=`"$NsA`" uniqueId=`"$uniqueId`">$body</dgm:layoutDef>"
}

# Own colors: node1 filled with $nodeScheme (accent2 marks "the part's content was used")
function New-ColorsXml([string]$uniqueId = $CsAccent1, [string]$nodeScheme = 'accent2') {
  $lbl = { param($name, $fill, $ln, $tx) "<dgm:styleLbl name=`"$name`"><dgm:fillClrLst meth=`"repeat`"><a:schemeClr val=`"$fill`"/></dgm:fillClrLst><dgm:linClrLst meth=`"repeat`"><a:schemeClr val=`"$ln`"/></dgm:linClrLst><dgm:effectClrLst/><dgm:txLinClrLst/><dgm:txFillClrLst meth=`"repeat`"><a:schemeClr val=`"$tx`"/></dgm:txFillClrLst><dgm:txEffectClrLst/></dgm:styleLbl>" }
  $s = (& $lbl 'node0' $nodeScheme 'lt1' 'lt1') + (& $lbl 'node1' $nodeScheme 'lt1' 'lt1') + (& $lbl 'sibTrans2D1' 'dk2' 'dk2' 'lt1') + (& $lbl 'parChTrans1D1' 'dk2' 'dk2' 'dk1')
  return "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><dgm:colorsDef xmlns:dgm=`"$NsDgm`" xmlns:a=`"$NsA`" uniqueId=`"$uniqueId`"><dgm:title val=`"`"/><dgm:desc val=`"`"/><dgm:catLst><dgm:cat type=`"accent1`" pri=`"11200`"/></dgm:catLst>$s</dgm:colorsDef>"
}

function New-StyleXml([string]$uniqueId = $QsSimple) {
  $st = '<dgm:style><a:lnRef idx="2"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef><a:fillRef idx="1"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef><a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></dgm:style>'
  $sc = '<dgm:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></dgm:scene3d><dgm:sp3d/><dgm:txPr/>'
  $l = ''; foreach ($n in 'node0', 'node1', 'sibTrans2D1', 'parChTrans1D1') { $l += "<dgm:styleLbl name=`"$n`">$sc$st</dgm:styleLbl>" }
  return "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><dgm:styleDef xmlns:dgm=`"$NsDgm`" xmlns:a=`"$NsA`" uniqueId=`"$uniqueId`"><dgm:title val=`"`"/><dgm:desc val=`"`"/><dgm:catLst><dgm:cat type=`"simple`" pri=`"10100`"/></dgm:catLst><dgm:scene3d><a:camera prst=`"orthographicFront`"/><a:lightRig rig=`"threePt`" dir=`"t`"/></dgm:scene3d>$l</dgm:styleDef>"
}

# Own geometry: OPF's drawing. Distinctive on purpose: red rounded rectangles in a diagonal staircase, text "OPF i".
function New-DrawingXml($ids, $nodes, [int64]$cx = 10160000, [int64]$cy = 5334000) {
  $n = $ids.Count; $w = [int64]($cx * 0.28); $h = [int64]($cy / ($n + 1)); $sb = New-Object Text.StringBuilder
  for ($i = 0; $i -lt $n; $i++) {
    $x = [int64](($cx - $w) * $i / [Math]::Max(1, $n - 1)); $y = [int64]($h * $i * 1.0)
    [void]$sb.Append("<dsp:sp modelId=`"$($ids[$i])`"><dsp:nvSpPr><dsp:cNvPr id=`"0`" name=`"`"/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off x=`"$x`" y=`"$y`"/><a:ext cx=`"$w`" cy=`"$h`"/></a:xfrm><a:prstGeom prst=`"roundRect`"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val=`"FF0000`"/></a:solidFill><a:ln><a:noFill/></a:ln></dsp:spPr><dsp:style><a:lnRef idx=`"0`"><a:scrgbClr r=`"0`" g=`"0`" b=`"0`"/></a:lnRef><a:fillRef idx=`"1`"><a:scrgbClr r=`"0`" g=`"0`" b=`"0`"/></a:fillRef><a:effectRef idx=`"0`"><a:scrgbClr r=`"0`" g=`"0`" b=`"0`"/></a:effectRef><a:fontRef idx=`"minor`"><a:schemeClr val=`"lt1`"/></a:fontRef></dsp:style><dsp:txBody><a:bodyPr anchor=`"ctr`"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn=`"ctr`"/><a:r><a:rPr lang=`"en-US`" sz=`"1800`"><a:solidFill><a:srgbClr val=`"FFFFFF`"/></a:solidFill></a:rPr><a:t>DRAWN $(Esc $nodes[$i].t)</a:t></a:r></a:p></dsp:txBody><dsp:txXfrm><a:off x=`"$x`" y=`"$y`"/><a:ext cx=`"$w`" cy=`"$h`"/></dsp:txXfrm></dsp:sp>")
  }
  return "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><dsp:drawing xmlns:dgm=`"$NsDgm`" xmlns:dsp=`"$NsDsp`" xmlns:a=`"$NsA`"><dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id=`"0`" name=`"`"/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>$sb</dsp:spTree></dsp:drawing>"
}

function New-SlideXml {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="OPF Diagram"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="1016000" y="762000"/><a:ext cx="10160000" cy="5334000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rId2" r:lo="rId3" r:qs="rId4" r:cs="rId5"/></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
}

function New-SlideRels([bool]$withDrawing) {
  $d = if ($withDrawing) { '<Relationship Id="rId6" Type="http://schemas.microsoft.com/office/2007/relationships/diagramDrawing" Target="../diagrams/drawing1.xml"/>' } else { '' }
  return "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><Relationships xmlns=`"http://schemas.openxmlformats.org/package/2006/relationships`"><Relationship Id=`"rId1`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout`" Target=`"../slideLayouts/slideLayout7.xml`"/><Relationship Id=`"rId2`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData`" Target=`"../diagrams/data1.xml`"/><Relationship Id=`"rId3`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout`" Target=`"../diagrams/layout1.xml`"/><Relationship Id=`"rId4`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramQuickStyle`" Target=`"../diagrams/quickStyle1.xml`"/><Relationship Id=`"rId5`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramColors`" Target=`"../diagrams/colors1.xml`"/>$d</Relationships>"
}

# Build a package: shell = a COM-saved blank deck (master, layouts, theme); every diagram part and the slide are OPF-written.
function New-OpfSmartArt([string]$shell, [string]$out, [string]$loId, $nodes, [hashtable]$opt) {
  if (-not $opt) { $opt = @{} }
  $withDrawing = -not $opt.noDrawing
  $data = New-DataXml $loId $nodes ($(if ($withDrawing) { 'rId6' } else { '' }))
  $layoutId = if ($opt.layoutId) { $opt.layoutId } else { $loId }
  $ct = Read-Part $shell '[Content_Types].xml'
  if (-not $withDrawing) { $ct = $ct -replace '<Override PartName="/ppt/diagrams/drawing1.xml"[^>]*/>', '' }
  $parts = @{
    'ppt/slides/slide1.xml'            = (New-SlideXml)
    'ppt/slides/_rels/slide1.xml.rels' = (New-SlideRels $withDrawing)
    'ppt/diagrams/data1.xml'           = $data.xml
    'ppt/diagrams/layout1.xml'         = (New-LayoutXml $layoutId ($(if ($opt.layoutKind) { $opt.layoutKind } else { 'min' })))
    'ppt/diagrams/quickStyle1.xml'     = (New-StyleXml)
    'ppt/diagrams/colors1.xml'         = (New-ColorsXml)
    'ppt/diagrams/drawing1.xml'        = $(if ($withDrawing) { New-DrawingXml $data.ids $nodes } else { $null })
    '[Content_Types].xml'              = $ct
    'docProps/thumbnail.jpeg'          = $null
  }
  if ($opt.omit) {
    $map = @{ lo = @('r:lo="rId3"', 'ppt/diagrams/layout1.xml', 'rId3'); qs = @('r:qs="rId4"', 'ppt/diagrams/quickStyle1.xml', 'rId4'); cs = @('r:cs="rId5"', 'ppt/diagrams/colors1.xml', 'rId5'); dm = @('r:dm="rId2"', 'ppt/diagrams/data1.xml', 'rId2') }
    foreach ($o in $opt.omit) {
      $m = $map[$o]
      $parts['ppt/slides/slide1.xml'] = $parts['ppt/slides/slide1.xml'].Replace(' ' + $m[0], '')
      $parts[$m[1]] = $null
      $parts['ppt/slides/_rels/slide1.xml.rels'] = $parts['ppt/slides/_rels/slide1.xml.rels'] -replace "<Relationship Id=`"$($m[2])`"[^>]*/>", ''
      $parts['[Content_Types].xml'] = $parts['[Content_Types].xml'] -replace "<Override PartName=`"/$([regex]::Escape($m[1]))`"[^>]*/>", ''
    }
  }
  if ($opt.noTrans) { $parts['ppt/diagrams/data1.xml'] = ($parts['ppt/diagrams/data1.xml'] -replace '<dgm:pt modelId="[^"]*" type="(parTrans|sibTrans)" cxnId="[^"]*"><dgm:prSet/><dgm:spPr/></dgm:pt>', '') -replace ' parTransId="[^"]*" sibTransId="[^"]*"', '' }
  if ($opt.realLayoutFrom) { $parts['ppt/diagrams/layout1.xml'] = (Read-Part $opt.realLayoutFrom 'ppt/diagrams/layout1.xml') }
  if (-not $withDrawing) { $parts.Remove('ppt/diagrams/drawing1.xml'); $parts['ppt/diagrams/drawing1.xml'] = $null }
  Write-Parts $shell $out $parts
  # thumbnail rel in _rels/.rels must go too
  $r = Read-Part $out '_rels/.rels'; $r = $r -replace '<Relationship[^>]*thumbnail[^>]*/>', ''
  $ct2 = (Read-Part $out '[Content_Types].xml') -replace '<Default Extension="jpeg"[^>]*/>', ''
  $tmp = "$out.tmp.pptx"; Move-Item $out $tmp -Force; Write-Parts $tmp $out @{ '_rels/.rels' = $r; '[Content_Types].xml' = $ct2 }; Remove-Item $tmp
}


# An OPF-authored layout definition written from ECMA-376 Part 1, 21.4 (no PowerPoint layout content):
# one row of rounded rectangles, fixed gap, fixed font size, no text-driven sizing.
function New-OpfRowLayoutXml([string]$uniqueId) {
  return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<dgm:layoutDef xmlns:dgm="$NsDgm" xmlns:a="$NsA" uniqueId="$uniqueId">
<dgm:title val="OPF Row"/><dgm:desc val="OPF test layout"/>
<dgm:catLst><dgm:cat type="process" pri="99000"/></dgm:catLst>
<dgm:layoutNode name="diagram">
<dgm:alg type="lin"><dgm:param type="linDir" val="fromL"/><dgm:param type="nodeVertAlign" val="mid"/></dgm:alg>
<dgm:shape><dgm:adjLst/></dgm:shape>
<dgm:presOf/>
<dgm:constrLst>
<dgm:constr type="w" for="ch" forName="node" refType="w"/>
<dgm:constr type="h" for="ch" forName="node" refType="w" refFor="ch" refForName="node" fact="0.5"/>
<dgm:constr type="w" for="ch" forName="gap" refType="w" refFor="ch" refForName="node" fact="0.2"/>
<dgm:constr type="primFontSz" for="ch" forName="node" op="equ" val="24"/>
</dgm:constrLst>
<dgm:ruleLst/>
<dgm:forEach name="nodesForEach" axis="ch" ptType="node">
<dgm:layoutNode name="node">
<dgm:varLst><dgm:bulletEnabled val="1"/></dgm:varLst>
<dgm:alg type="tx"/>
<dgm:shape type="roundRect"><dgm:adjLst/></dgm:shape>
<dgm:presOf axis="desOrSelf" ptType="node"/>
<dgm:constrLst><dgm:constr type="tMarg" refType="primFontSz" refFor="self" fact="0.2"/><dgm:constr type="bMarg" refType="primFontSz" fact="0.2"/><dgm:constr type="lMarg" refType="primFontSz" fact="0.2"/><dgm:constr type="rMarg" refType="primFontSz" fact="0.2"/></dgm:constrLst>
<dgm:ruleLst/>
</dgm:layoutNode>
<dgm:forEach name="gapForEach" axis="followSib" ptType="sibTrans" cnt="1">
<dgm:layoutNode name="gap"><dgm:alg type="sp"/><dgm:shape><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode>
</dgm:forEach>
</dgm:forEach>
</dgm:layoutNode>
</dgm:layoutDef>
"@
}
