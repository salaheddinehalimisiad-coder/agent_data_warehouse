# start.ps1
Write-Host "🚀 Démarrage de l'Agentic ETL..." -ForegroundColor Cyan

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; .\.venv\Scripts\Activate.ps1; python -m uvicorn api.server:app --reload --port 8000"

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"

Write-Host "✅ Backend (8000) et Frontend (5173) lancés dans des fenêtres séparées." -ForegroundColor Green
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
