#!/bin/sh
set -e

if [ ! -f .env ]; then
    echo "Error: .env file not found. Copy .env.example to .env and set your password first."
    exit 1
fi

docker compose up --build -d
echo "App is running at http://localhost:8000"