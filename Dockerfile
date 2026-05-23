FROM node:22-alpine AS frontend-build

ARG NEXT_PUBLIC_ADMIN_USERNAME=admin
ARG NEXT_PUBLIC_ADMIN_PASSWORD=password
ENV NEXT_PUBLIC_ADMIN_USERNAME=$NEXT_PUBLIC_ADMIN_USERNAME
ENV NEXT_PUBLIC_ADMIN_PASSWORD=$NEXT_PUBLIC_ADMIN_PASSWORD

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS app

WORKDIR /app/backend

COPY --from=ghcr.io/astral-sh/uv:0.6.17 /uv /uvx /usr/local/bin/
COPY backend/pyproject.toml backend/README.md ./
RUN uv sync --no-dev

COPY backend/ ./
COPY --from=frontend-build /app/frontend/out ./static

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
