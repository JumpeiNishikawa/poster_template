<#
.SYNOPSIS
  参照PDF（お手本・前年版・入稿前確認など）を画像化して見比べるユーティリティ．

.DESCRIPTION
  pdftoppm（poppler）で指定PDFを指定DPIのPNG群に変換し，out\<Prefix>-*.png に書き出す．
  AIや人間が「お手本PDF」を画像として読めるようにするためのもの．poppler（pdftoppm）が必要．

.PARAMETER Pdf
  画像化する対象PDFのパス（必須）．

.PARAMETER Dpi
  解像度．既定 200．

.PARAMETER Prefix
  出力PNGの接頭辞（out\<Prefix>-1.png ...）．既定 ref．

.EXAMPLE
  pwsh tools/view_pdf.ps1 -Pdf ..\refs\last_year.pdf
  pwsh tools/view_pdf.ps1 -Pdf out\poster.pdf -Dpi 150 -Prefix self
#>
param(
  [Parameter(Mandatory = $true)][string]$Pdf,
  [int]$Dpi = 200,
  [string]$Prefix = 'ref'
)

if (-not (Test-Path $Pdf)) { throw "PDFが見つかりません: $Pdf" }
if (-not (Get-Command pdftoppm -ErrorAction SilentlyContinue)) {
  throw "pdftoppm が見つかりません． poppler をインストールしてください（例: scoop install poppler）．"
}

$outDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'out'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$out = Join-Path $outDir $Prefix

pdftoppm -r $Dpi -png $Pdf $out
Write-Host "出力: $($out)-*.png"
