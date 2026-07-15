param(
    [string]$Workspace = (Split-Path -Parent $PSScriptRoot)
)

Write-Host "Processing pending submissions from $Workspace"
Push-Location $Workspace

try {
    npm run process:pending
}
finally {
    Pop-Location
}
