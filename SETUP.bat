@echo off
REM Primz AI - Complete Setup & Deployment Script (Windows)
REM =========================================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo 🚀 Primz AI - Complete Setup
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ package.json not found!
    echo Please run this script from your primz-ai project root directory.
    pause
    exit /b 1
)

if not exist ".git" (
    echo ❌ Not a git repository!
    echo Please run 'git init' first.
    pause
    exit /b 1
)

REM Get GitHub username
set /p GITHUB_USER="Enter your GitHub username: "

if "%GITHUB_USER%"=="" (
    echo ❌ GitHub username is required
    pause
    exit /b 1
)

echo.
echo ℹ️  This will copy:
echo   • 3 service files to src\lib\services\
echo   • 5 component files to src\components\
echo   • 4 API route files to src\app\api\
echo   • 1 database migration to supabase\migrations\
echo.
set /p CONTINUE="Continue? (y/n): "

if not "%CONTINUE%"=="y" (
    echo ❌ Setup cancelled
    pause
    exit /b 1
)

echo.
echo ========================================
echo Copying Files
echo ========================================
echo.

REM Create directories
echo Creating directories...
if not exist "src\lib\services" mkdir "src\lib\services"
if not exist "src\components\api-keys" mkdir "src\components\api-keys"
if not exist "src\components\chat" mkdir "src\components\chat"
if not exist "src\components\leads" mkdir "src\components\leads"
if not exist "src\app\api\groq-keys" mkdir "src\app\api\groq-keys"
if not exist "src\app\api\apify-keys" mkdir "src\app\api\apify-keys"
if not exist "src\app\api\lead-type\detect" mkdir "src\app\api\lead-type\detect"
if not exist "src\app\api\leads\[id]\delete" mkdir "src\app\api\leads\[id]\delete"
if not exist "supabase\migrations" mkdir "supabase\migrations"

echo Copying services...
copy "..\primz-ai-complete\src\lib\services\*.ts" "src\lib\services\" >nul 2>&1

echo Copying components...
copy "..\primz-ai-complete\src\components\api-keys\*.tsx" "src\components\api-keys\" >nul 2>&1
copy "..\primz-ai-complete\src\components\chat\*.tsx" "src\components\chat\" >nul 2>&1
copy "..\primz-ai-complete\src\components\leads\*.tsx" "src\components\leads\" >nul 2>&1

echo Copying API routes...
copy "..\primz-ai-complete\src\app\api\groq-keys\route.ts" "src\app\api\groq-keys\" >nul 2>&1
copy "..\primz-ai-complete\src\app\api\apify-keys\route.ts" "src\app\api\apify-keys\" >nul 2>&1
copy "..\primz-ai-complete\src\app\api\lead-type\detect\route.ts" "src\app\api\lead-type\detect\" >nul 2>&1
copy "..\primz-ai-complete\src\app\api\leads\[id]\delete\route.ts" "src\app\api\leads\[id]\delete\" >nul 2>&1

echo Copying migration...
copy "..\primz-ai-complete\supabase\migrations\0005_*.sql" "supabase\migrations\" >nul 2>&1

echo Copying documentation...
copy "..\primz-ai-complete\README.md" "PRIMZ-AI-FEATURES-README.md" >nul 2>&1
copy "..\primz-ai-complete\INTEGRATION_GUIDE.md" "PRIMZ-AI-INTEGRATION.md" >nul 2>&1

echo ✅ Files copied!

echo.
echo ========================================
echo 📝 Creating Git Commit
echo ========================================
echo.

echo Creating branch...
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set BRANCH_NAME=feat/api-keys-and-lead-detection-%mydate%-%mytime%

git checkout -b %BRANCH_NAME%

echo Staging files...
git add src\lib\services\ src\components\ src\app\api\ supabase\migrations\ *.md

echo.
echo ✅ Files staged!

set /p COMMIT_CONFIRM="Proceed with commit and push? (y/n): "

if not "%COMMIT_CONFIRM%"=="y" (
    echo ⚠️  Changes are staged but not committed.
    pause
    exit /b 1
)

echo Creating commit...
git commit -m "feat: add multiple API keys, lead detection, and rate limiting"

echo Pushing to GitHub...
git push -u origin %BRANCH_NAME%

echo.
echo ========================================
echo ✨ Setup Complete!
echo ========================================
echo.
echo ✅ All files deployed successfully!
echo.
echo 📋 NEXT STEPS (REQUIRED):
echo.
echo 1️⃣  Review Pull Request:
echo    https://github.com/%GITHUB_USER%/primz-ai/pull
echo.
echo 2️⃣  Merge to main branch
echo    (Your Render app will auto-deploy)
echo.
echo 3️⃣  Run Supabase Migration:
echo    • File: supabase/migrations/0005_add_api_keys_and_features.sql
echo    • Go to Supabase → SQL Editor
echo    • Copy ^& execute the migration
echo.
echo 4️⃣  Update Settings Page:
echo    • File: src/app/(app)/settings/page.tsx
echo    • See PRIMZ-AI-INTEGRATION.md for code
echo.
echo 5️⃣  Test Features:
echo    • Go to Settings → API Keys Management
echo    • Add a Groq API key
echo    • Add an Apify API key
echo.
echo 🎉 Deployment started! Ready for PR merge.
echo.

pause
