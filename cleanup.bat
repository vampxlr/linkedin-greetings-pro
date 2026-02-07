@echo off
echo Killing lingering Node.js processes...
taskkill /F /IM node.exe
echo Killing lingering Chrome processes (releasing profile lock)...
taskkill /F /IM chrome.exe
echo Cleanup complete. You can now run start_robust_bot.bat
pause
