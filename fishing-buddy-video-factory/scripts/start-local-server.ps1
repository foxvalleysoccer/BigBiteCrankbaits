param(
    [string]$NodePath = "",
    [int]$Port = 4307
)

$candidatePaths = @(
    $NodePath,
    (Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe"
) | Where-Object { $_ }

$resolvedNode = $candidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $resolvedNode) {
    throw "No usable node.exe was found."
}

$scriptPath = Join-Path $PSScriptRoot "..\apps\server\local-server.mjs"
$scriptPath = [System.IO.Path]::GetFullPath($scriptPath)
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))

$env:PORT = "$Port"
$env:FACTORY_DATA_ROOT = Join-Path $projectRoot "data"

Write-Host "Starting Fishing Buddy local server with $resolvedNode"
Write-Host "Project root: $projectRoot"
& $resolvedNode $scriptPath
