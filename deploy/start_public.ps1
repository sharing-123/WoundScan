# Starts the WoundScan container (Neon database) and a public Cloudflare quick tunnel. Run again after a reboot.
#   powershell -ExecutionPolicy Bypass -File deploy\start_public.ps1
# Needs Docker Desktop running, .env.local with DATABASE_URL (neon deploy writes it) and cloudflared.exe (path below).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$cf = if ($env:CLOUDFLARED) { $env:CLOUDFLARED } else { Join-Path $root "deploy\cloudflared.exe" }
if (-not (Test-Path $cf)) { throw "cloudflared.exe not found. Download cloudflared-windows-amd64.exe from github.com/cloudflare/cloudflared/releases and save it as deploy\cloudflared.exe" }
$line = Get-Content (Join-Path $root ".env.local") | Where-Object { $_ -like "DATABASE_URL=*" } | Select-Object -First 1
$env:DATABASE_URL = $line.Substring(13).Trim('"', "'")
$state = docker ps -a --filter "name=woundscan-public" --format "{{.Status}}"
if (-not $state) { docker run -d --restart unless-stopped --name woundscan-public -p 7860:7860 -e DATABASE_URL woundscan | Out-Null }
elseif ($state -notlike "Up*") { docker start woundscan-public | Out-Null }
for ($i = 0; $i -lt 40; $i++) { try { Invoke-RestMethod http://127.0.0.1:7860/api/health | Out-Null; break } catch { Start-Sleep 3 } }
Write-Host "App is up. Opening the public tunnel (the https://....trycloudflare.com address appears below; it changes every time)."
& $cf tunnel --url http://localhost:7860
