param([int]$ApiPort = 8000, [int]$WebPort = 4173)
$ErrorActionPreference = 'Stop'
$api = Join-Path $PSScriptRoot 'backend_TuristeaYa/api'
$web = Join-Path $PSScriptRoot 'frontend_TuristeaYa'
$python = Join-Path $api '.venv-test/Scripts/python.exe'
if (!(Test-Path -LiteralPath $python)) { $python = Join-Path $api '.venv/Scripts/python.exe' }
if (!(Test-Path -LiteralPath $python)) { throw 'Crea un entorno virtual en backend_TuristeaYa/api e instala requirements.txt.' }
if (!(Test-Path -LiteralPath (Join-Path $api '.env'))) { throw 'Configura api/.env usando .env.example y la clave pública de Supabase.' }
$apiProcess = $null
try {
  $apiProcess = Start-Process -FilePath $python -ArgumentList @('-m','uvicorn','main:app','--host','127.0.0.1','--port',"$ApiPort") -WorkingDirectory $api -WindowStyle Hidden -PassThru
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if ($apiProcess.HasExited) { throw 'El backend no pudo iniciar. Comprueba si el puerto está ocupado.' }
    try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/health" -TimeoutSec 2; $ready = $health.status -eq 'ok' } catch { }
    if ($ready) { break }
    Start-Sleep -Milliseconds 500
  }
  if (!$ready) { throw 'El backend no respondió a tiempo.' }
  $env:API_ORIGIN = "http://127.0.0.1:$ApiPort"
  $env:PORT = "$WebPort"
  Write-Host "Abre http://127.0.0.1:$WebPort . Cierra con Ctrl+C."
  & node (Join-Path $web 'scripts/serve.mjs')
} finally {
  if ($apiProcess -and !$apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id }
}
