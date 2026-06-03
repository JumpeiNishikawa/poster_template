<#
.SYNOPSIS
  poster_template から新しいポスター制作フォルダを別の場所に生成する．

.DESCRIPTION
  原本（poster_template.html / poster_spec.md）と制作ツール（lint/render）を
  案件フォルダにコピーし，自己完結したプロジェクトを作る．
  生成フォルダ単体で lint / render が動く（テンプレリポに依存しない）．

.PARAMETER Name
  案件名（フォルダ名になる）．例: his2026, cogsci2026_attention

.PARAMETER Dest
  生成先の親ディレクトリ．省略時は $HOME\dev\posters．

.PARAMETER NoGit
  指定すると git init / 初期コミットを行わない．

.EXAMPLE
  pwsh tools/new-poster.ps1 -Name his2026
  pwsh tools/new-poster.ps1 -Name cogsci2026 -Dest D:\work\posters
#>
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Dest = (Join-Path $HOME 'dev\posters'),
  [switch]$NoGit
)

$ErrorActionPreference = 'Stop'

$templateRoot = Split-Path $PSScriptRoot -Parent
$projectDir   = Join-Path $Dest $Name

if (Test-Path $projectDir) {
  throw "既に存在します: $projectDir（別の名前を指定してください）"
}

# ---- ディレクトリ作成 ----
New-Item -ItemType Directory -Path $projectDir            -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectDir 'tools')   -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectDir 'figures') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectDir 'out')     -Force | Out-Null

# ---- ファイルコピー ----
Copy-Item (Join-Path $templateRoot 'poster_template.html') (Join-Path $projectDir 'poster.html')
Copy-Item (Join-Path $templateRoot 'poster_spec.md')       (Join-Path $projectDir 'poster_spec.md')
Copy-Item (Join-Path $templateRoot 'tools\lint.mjs')       (Join-Path $projectDir 'tools\lint.mjs')
Copy-Item (Join-Path $templateRoot 'tools\render.mjs')     (Join-Path $projectDir 'tools\render.mjs')
Copy-Item (Join-Path $templateRoot 'tools\scaffold\CLAUDE.md')  (Join-Path $projectDir 'CLAUDE.md')
Copy-Item (Join-Path $templateRoot 'tools\scaffold\content.md') (Join-Path $projectDir 'content.md')

# ---- figures / out を git管理に乗せるための placeholder ----
New-Item -ItemType File -Path (Join-Path $projectDir 'figures\.gitkeep') | Out-Null

# ---- .gitignore（out は成果物なので除外）----
@"
out/
*.pdf
"@ | Set-Content -Path (Join-Path $projectDir '.gitignore') -Encoding utf8

# ---- .gitattributes（改行コード固定）----
Copy-Item (Join-Path $templateRoot '.gitattributes') (Join-Path $projectDir '.gitattributes') -ErrorAction SilentlyContinue

# ---- git 初期化 ----
if (-not $NoGit) {
  Push-Location $projectDir
  try {
    git init -q
    git add -A
    git commit -q -m "Scaffold poster project: $Name (from poster_template)"
  } catch {
    Write-Warning "git 初期化に失敗しました: $_"
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "✓ 生成しました: $projectDir" -ForegroundColor Green
Write-Host ""
Write-Host "次の手順:" -ForegroundColor Cyan
Write-Host "  1. cd `"$projectDir`""
Write-Host "  2. content.md に素材を記入"
Write-Host "  3. poster.html に流し込み"
Write-Host "  4. node tools/lint.mjs        # 仕様チェック"
Write-Host "  5. node tools/render.mjs      # out/poster.pdf + out/poster.png 生成"
Write-Host ""
Write-Host "詳細は生成フォルダ内の CLAUDE.md を参照．"
