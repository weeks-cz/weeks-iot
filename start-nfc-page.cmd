@echo off
cd /d "%~dp0"
npm.cmd run build
"C:\Program Files\nodejs\node.exe" "%~dp0node_modules\next\dist\bin\next" start -H 127.0.0.1 -p 3000
