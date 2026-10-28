@echo off
echo ========================================================
echo Pushing RAXI WIN project to GitHub (shuny03/raxi)...
echo ========================================================
cd /d "%~dp0"
git push -u origin main
echo.
echo If prompted, please sign in via the browser window.
pause
