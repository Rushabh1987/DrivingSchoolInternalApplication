# Development

## Frontend

```bash
cd frontend
npm run dev
```

Frontend dev server:

```text
http://localhost:3000
```

MVP admin credentials:

```text
Username: admin
Password: password
```

MVP session behavior:

```text
Session expires after 12 hours.
Closing the browser tab requires signing in again.
Refreshing the same tab keeps the session until it expires.
```

## Backend

Install `uv` if it is not available:

```bash
python -m pip install --user uv
```

```bash
cd backend
uv run uvicorn app.main:app --reload
```

Backend health endpoint:

```text
http://localhost:8000/health
```

Backend tests:

```bash
cd backend
python -m uv run pytest
```

## Docker

```bash
docker compose up --build
```

App URL when running from Docker:

```text
http://localhost:8000
```
