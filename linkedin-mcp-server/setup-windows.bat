@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  LinkedIn MCP Server - Windows Setup
echo ============================================
echo.

:: --- Find Node.js ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install it from https://nodejs.org and run this script again.
    pause
    exit /b 1
)
echo [OK] Node.js found.

:: --- Locate this script's directory ---
set "SCRIPT_DIR=%~dp0"
set "SERVER_JS=%SCRIPT_DIR%dist\index.js"

if not exist "%SERVER_JS%" (
    echo [ERROR] dist\index.js not found in %SCRIPT_DIR%
    echo Make sure you are running this script from inside the linkedin-mcp-server folder.
    pause
    exit /b 1
)
echo [OK] Server found at: %SERVER_JS%

:: --- Close existing Chrome ---
echo.
echo Closing Chrome (needed to relaunch with debug port)...
taskkill /f /im chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: --- Relaunch Chrome with remote debugging ---
echo Launching Chrome with remote debugging on port 9222...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run
timeout /t 3 /nobreak >nul
echo [OK] Chrome launched. Please log into LinkedIn now if not already logged in.

:: --- Write Claude Desktop config ---
set "CLAUDE_CONFIG=%APPDATA%\Claude\claude_desktop_config.json"
set "CLAUDE_DIR=%APPDATA%\Claude"

if not exist "%CLAUDE_DIR%" (
    mkdir "%CLAUDE_DIR%"
)

:: Escape backslashes for JSON
set "SERVER_JS_JSON=%SERVER_JS:\=\\%"

echo.
echo Writing Claude Desktop config...
(
echo {
echo   "mcpServers": {
echo     "linkedin": {
echo       "command": "node",
echo       "args": ["%SERVER_JS_JSON%"],
echo       "env": { "CHROME_DEBUG_PORT": "9222" }
echo     }
echo   }
echo }
) > "%CLAUDE_CONFIG%"

echo [OK] Config written to: %CLAUDE_CONFIG%

:: --- Done ---
echo.
echo ============================================
echo  Setup complete!
echo ============================================
echo.
echo Next steps:
echo  1. Make sure you are logged into LinkedIn in the Chrome window that just opened.
echo  2. Go to http://localhost:9222/json in Chrome to verify debug mode is active.
echo  3. Fully quit Claude Desktop (system tray - right-click - Quit).
echo  4. Reopen Claude Desktop.
echo  5. Type: "Get my LinkedIn profile"
echo.
pause
