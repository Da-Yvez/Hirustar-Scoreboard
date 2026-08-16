@echo off
:loop
echo ========================================================
echo Starting Hirustar Scoreboard...
echo ========================================================
node server.js
echo.
echo [!] Server crashed or stopped! Restarting in 2 seconds...
timeout /t 2 >nul
goto loop
