@echo off
echo ======================================================================
echo  Starting QMaps: Intelligent Traffic Route Optimization (Navi Mumbai)
echo ======================================================================
echo.

echo [1/2] Starting FastAPI Optimization Backend on port 8000...
start "QMaps FastAPI Backend" cmd /k "python api/main.py"

echo [2/2] Starting Next.js Frontend on port 3000...
cd frontend
start "QMaps Frontend" cmd /k "npm run dev"

echo.
echo ======================================================================
echo  QMaps Services Launched!
echo  - Frontend: http://localhost:3000
echo  - Backend API: http://localhost:8000
echo  - API Docs: http://localhost:8000/docs
echo ======================================================================
