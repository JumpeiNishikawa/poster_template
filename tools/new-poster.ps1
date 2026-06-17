<#
.SYNOPSIS
  poster_template から新しいポスター制作フォルダを別の場所に生成する．
  既存案件にテンプレ側のツール更新だけを入れ直す -RefreshTools も持つ．

.DESCRIPTION
  原本（poster_template.html / poster_spec.md）と制作ツール（lint/render/view_pdf）を
  案件フォルダにコピーし，自己完結したプロジェクトを作る．
  生成フォルダ単体で lint / render が動く（テンプレリポに依存しない）．
  生成時にテンプレの来歴（commit）を docs/PROJECT_LOG.md に刻む（知見還元=harvest の基準）．

.PARAMETER Name
  案件名（フォルダ名になる）．例: his2026, cogsci2026_attention

.PARAMETER Dest
  生成先の親ディレクトリ．省略時は $HOME\dev\posters．

.PARAMETER NoGit
  指定すると git init / 初期コミットを行わない．

.PARAMETER RefreshTools
  既存案件（$Dest\$Name）に対し，テンプレ側のフレームワークファイル
  （tools/lint.mjs・render.mjs・view_pdf.ps1・poster_spec.md）だけを上書き更新する．
  poster.html・content.md・docs（案件の所有物）には触れない．git commit もしない（レビューは手動）．

.EXAMPLE
  pwsh tools/new-poster.ps1 -Name his2026
  pwsh tools/new-poster.ps1 -Name cogsci2026 -Dest D:\work\posters
  pwsh tools/new-poster.ps1 -Name his2026 -RefreshTools   # 既存案件のツールだけ更新
#>
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Dest = (Join-Path $HOME 'dev\posters'),
  [switch]$NoGit,
  [switch]$RefreshTools
)

$ErrorActionPreference = 'Stop'

$templateRoot = Split-Path $PSScriptRoot -Parent
$projectDir   = Join-Path $Dest $Name

# テンプレ来歴（派生元の特定／harvest の基準に使う）
$tplCommit = $null
try { $tplCommit = (& git -C $templateRoot rev-parse --short HEAD 2>$null) } catch {}
$origin = if ($tplCommit) { "poster_template @ $tplCommit" } else { 'poster_template (commit不明)' }
$today  = Get-Date -Format 'yyyy-MM-dd'

# フレームワークファイル（テンプレとの同期を保つべきもの．案件側で編集しない前提）
$frameworkFiles = @(
  'tools\lint.mjs',
  'tools\render.mjs',
  'tools\view_pdf.ps1',
  'poster_spec.md'
)

# ============================================================
#  -RefreshTools : 既存案件のフレームワークだけ更新して終了
# ============================================================
if ($RefreshTools) {
  if (-not (Test-Path $projectDir)) {
    throw "案件が見つかりません: $projectDir（-RefreshTools は既存案件に対して使う）"
  }
  New-Item -ItemType Directory -Path (Join-Path $projectDir 'tools') -Force | Out-Null
  foreach ($rel in $frameworkFiles) {
    Copy-Item (Join-Path $templateRoot $rel) (Join-Path $projectDir $rel) -Force
    Write-Host "  更新: $rel"
  }
  Write-Host ""
  Write-Host "✓ ツールを更新しました（$origin）: $projectDir" -ForegroundColor Green
  Write-Host "  poster.html・content.md・docs は触っていません．差分を確認して commit してください．"
  return
}

# ============================================================
#  通常：新規案件を生成
# ============================================================
if (Test-Path $projectDir) {
  throw "既に存在します: $projectDir（別の名前を指定するか，更新なら -RefreshTools を使う）"
}

# ---- ディレクトリ作成 ----
New-Item -ItemType Directory -Path $projectDir            -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectDir 'tools')   -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectDir 'figures') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectDir 'out')     -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectDir 'docs')    -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectDir 'fonts')   -Force | Out-Null

# ---- ファイルコピー ----
Copy-Item (Join-Path $templateRoot 'poster_template.html') (Join-Path $projectDir 'poster.html')
Copy-Item (Join-Path $templateRoot 'poster_spec.md')       (Join-Path $projectDir 'poster_spec.md')
Copy-Item (Join-Path $templateRoot 'tools\lint.mjs')       (Join-Path $projectDir 'tools\lint.mjs')
Copy-Item (Join-Path $templateRoot 'tools\render.mjs')     (Join-Path $projectDir 'tools\render.mjs')
Copy-Item (Join-Path $templateRoot 'tools\view_pdf.ps1')   (Join-Path $projectDir 'tools\view_pdf.ps1')
Copy-Item (Join-Path $templateRoot 'tools\scaffold\AGENTS.md')  (Join-Path $projectDir 'AGENTS.md')
Copy-Item (Join-Path $templateRoot 'tools\scaffold\content.md') (Join-Path $projectDir 'content.md')
Copy-Item (Join-Path $templateRoot 'tools\scaffold\docs\*.md')  (Join-Path $projectDir 'docs')

# ---- 来歴スタンプを docs/PROJECT_LOG.md のタイトル直後に差し込む ----
$logPath = Join-Path $projectDir 'docs\PROJECT_LOG.md'
if (Test-Path $logPath) {
  $out = @()
  $inserted = $false
  foreach ($l in (Get-Content $logPath)) {
    $out += $l
    if (-not $inserted -and $l -match '^#\s*Project Log') {
      $out += ''
      $out += '## 派生元（テンプレート来歴）'
      $out += ''
      $out += "- 生成元: $origin"
      $out += "- 生成日: $today"
      $out += ''
      $out += '> harvest（知見の還元）時に「どのテンプレ版から派生したか」の基準．テンプレ側 docs/BACKPORT.md 参照．'
      $inserted = $true
    }
  }
  Set-Content -Path $logPath -Value $out -Encoding utf8
}

# ---- figures / fonts / out を git管理に乗せるための placeholder ----
New-Item -ItemType File -Path (Join-Path $projectDir 'figures\.gitkeep') | Out-Null
New-Item -ItemType File -Path (Join-Path $projectDir 'fonts\.gitkeep')   | Out-Null

# ---- .gitignore（out の中間物は除外，安定版の最終成果物のみ追跡）----
@"
# レンダリング作業中の中間物は追跡しない
out/*
# 安定版の最終成果物は追跡に含める（GitHub公開・配布用）．確定時だけ git add する．
!out/poster.pdf
!out/poster.png
"@ | Set-Content -Path (Join-Path $projectDir '.gitignore') -Encoding utf8

# ---- .gitattributes（改行コード固定）----
Copy-Item (Join-Path $templateRoot '.gitattributes') (Join-Path $projectDir '.gitattributes') -ErrorAction SilentlyContinue

# ---- git 初期化 ----
if (-not $NoGit) {
  Push-Location $projectDir
  try {
    git init -q
    git add -A
    git commit -q -m "Scaffold poster project: $Name (from $origin)"
  } catch {
    Write-Warning "git 初期化に失敗しました: $_"
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "✓ 生成しました: $projectDir  （$origin）" -ForegroundColor Green
Write-Host ""
Write-Host "次の手順:" -ForegroundColor Cyan
Write-Host "  1. cd `"$projectDir`""
Write-Host "  2. content.md に素材を記入"
Write-Host "  3. poster.html に流し込み"
Write-Host "  4. node tools/lint.mjs        # 仕様チェック"
Write-Host "  5. node tools/render.mjs      # out/poster.pdf + out/poster.png 生成"
Write-Host ""
Write-Host "詳細は生成フォルダ内の AGENTS.md を参照．"
Write-Host "完成後は AGENTS.md の「完成後：知見の還元(harvest)」に従い，学びをテンプレへ戻す．"
