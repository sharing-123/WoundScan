@echo off
rem WoundScan website + local API on http://127.0.0.1:8780 (loopback only, nothing leaves this computer)
cd /d "%~dp0"
if not exist "web\dist\index.html" (
  echo Building the website once...
  pushd web
  call npm install
  call npm run build
  popd
)
start "" http://127.0.0.1:8780
python server\run.py
