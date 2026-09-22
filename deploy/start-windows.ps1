$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$version = 'v22.23.2'
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$dest = Join-Path $root 'deploy\.node'
$bundled = Join-Path $dest "node-$version-win-$arch\node.exe"

function Node-Major([string]$exe) {
  $raw = & $exe -p "process.versions.node.split('.')[0]"
  return [int]$raw
}

$node = $null
$installed = Get-Command node -ErrorAction SilentlyContinue
if ($installed) {
  try {
    if ((Node-Major $installed.Source) -ge 20) {
      $node = $installed.Source
    }
  } catch {
    $node = $null
  }
}
if (-not $node -and (Test-Path $bundled)) {
  $node = $bundled
}
if (-not $node) {
  Write-Host 'Downloading Node.js. This happens once and needs internet.'
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  $zip = Join-Path $dest 'node.zip'
  $url = "https://nodejs.org/dist/$version/node-$version-win-$arch.zip"
  Invoke-WebRequest -Uri $url -OutFile $zip
  tar -xf $zip -C $dest
  Remove-Item $zip
  if (-not (Test-Path $bundled)) {
    throw 'Node.js downloaded, but node.exe was not found.'
  }
  $node = $bundled
}

$env:PATH = "$(Split-Path $node -Parent);$env:PATH"
Write-Host 'Starting Smartosa. The first start can take several minutes. Leave this window open.'
& $node (Join-Path $root 'deploy\start.mjs')
exit $LASTEXITCODE
