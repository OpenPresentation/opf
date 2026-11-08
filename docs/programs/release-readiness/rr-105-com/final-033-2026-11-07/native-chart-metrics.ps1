param([string]$Out='C:\opf-work\release-033-artifacts\native-chart-metrics.json')
$ErrorActionPreference='Stop'
if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'Refusing to attach to an existing PowerPoint process.'}
$app=New-Object -ComObject PowerPoint.Application
$owned=New-Object 'System.Collections.Generic.List[object]'
$rows=@()
function Safe([scriptblock]$b){try{& $b}catch{$null}}
try{
 $app.DisplayAlerts=1
 foreach($name in @('lh93','histogram-pareto','chart-types')){
  $file=switch($name){'lh93'{'C:\opf-work\release-033-artifacts\extras\pptx\lh93.pptx'} 'histogram-pareto'{'C:\opf-work\release-033-artifacts\qualification\pptx\layout-harvest.pptx'} 'chart-types'{'C:\opf-work\release-033-artifacts\qualification\pptx\chart-type-sampler.pptx'}}
  $p=$null
  try{
   $p=$app.Presentations.Open($file,-1,0,0);[void]$owned.Add($p)
   $indices=if($name -eq 'lh93'){@(1,2,3)}elseif($name -eq 'histogram-pareto'){@(17,18)}else{@(1)}
   foreach($n in $indices){$s=$p.Slides.Item($n);for($k=1;$k -le $s.Shapes.Count;$k++){$shape=$s.Shapes.Item($k);if((Safe {$shape.HasChart}) -ne -1){continue};$chart=$shape.Chart;$axes=@();for($a=1;$a -le 2;$a++){$axis=Safe {$chart.Axes($a,1)};if($axis){$axes+=,[ordered]@{kind=$a;min=(Safe {$axis.MinimumScale});max=(Safe {$axis.MaximumScale});major=(Safe {$axis.MajorUnit});majorGridlines=(Safe {$axis.HasMajorGridlines})}}
    }
    $rows+=,[ordered]@{file=$name;slide=$n;name=$shape.Name;type=$chart.ChartType;series=(Safe {$chart.SeriesCollection().Count});inside=@((Safe {$chart.PlotArea.InsideLeft}),(Safe {$chart.PlotArea.InsideTop}),(Safe {$chart.PlotArea.InsideWidth}),(Safe {$chart.PlotArea.InsideHeight}));axes=$axes}
   }}
  }finally{if($p){$p.Saved=-1;$p.Close();[void]$owned.Remove($p)}}
 }
 $rows | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath $Out -Encoding UTF8
}finally{foreach($p in $owned){$p.Saved=-1;$p.Close()};if($app.Presentations.Count -eq 0){$app.Quit()};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)}