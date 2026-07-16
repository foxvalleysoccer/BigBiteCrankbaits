param(
    [string]$ServerUrl = "http://127.0.0.1:4307"
)

$endpoint = "$ServerUrl/operator/import-gmail-submissions"
Write-Host "Importing structured email submissions from $endpoint"
Invoke-WebRequest -Uri $endpoint -Method POST -UseBasicParsing | Select-Object -ExpandProperty Content
