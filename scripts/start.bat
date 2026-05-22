@echo off
if not exist .env (
    echo .env file not found. Copy .env.example to .env and set your password first.
    exit /b 1
)
docker compose up --build -d
echo App is running at http://localhost:8000
