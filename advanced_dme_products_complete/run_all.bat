@echo off
REM DME Products Complete Processing Pipeline (Windows)

setlocal enabledelayedexpansion

cls
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║   DME Products - Complete Processing Pipeline (Windows)      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Check Python
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Install Python 3.6+ from python.org
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] Python %PYTHON_VERSION%
echo.

REM Install dependencies
echo [2/5] Installing dependencies...
python -m pip install -q requests >nul 2>&1
echo [OK] Dependencies installed
echo.

REM Step 1: Consolidate
echo [3/5] Consolidating products from extracted pages...
python consolidate_products.py
echo.

REM Step 2: Download images
if exist "products.json" (
    echo [4/5] Downloading product images...
    python image_downloader.py
    echo.
    
    REM Step 3: Generate reports
    echo [5/5] Generating analytics reports...
    python generate_reports.py
) else (
    echo [SKIP] No products.json found - skipping images and reports
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  [OK] Pipeline Complete!                                     ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Generated files:
echo    * products.json         - Consolidated product data
echo    * products.csv          - Spreadsheet format
echo    * images/               - Organized product images
echo    * reports/              - Analytics and statistics
echo.
echo Next steps:
echo    1. Open reports/analytics_report.html in your browser
echo    2. Check products.csv in Excel
echo    3. Integrate products.json into your system
echo.
pause
