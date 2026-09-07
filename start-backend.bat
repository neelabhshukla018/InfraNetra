@echo off
title InfraNetra FastAPI Backend (Port 8000)
echo =======================================================
echo Starting InfraNetra FastAPI Backend Server...
echo URL: http://127.0.0.1:8000
echo =======================================================
backend\venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
pause
