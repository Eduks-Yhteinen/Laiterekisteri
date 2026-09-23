# NAS Backup Wrapper Script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location -Path $ProjectRoot

Write-Host "Kaynnistetaan NAS varmuuskopiointi..."
node .\scripts\nas-backup.cjs

if ($LASTEXITCODE -ne 0) {
    Write-Host "Varmuuskopiointi epaonnistui." -ForegroundColor Red
} else {
    Write-Host "Varmuuskopiointi onnistui." -ForegroundColor Green
}
