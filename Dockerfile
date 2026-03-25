FROM node:20-slim AS frontend-builder
WORKDIR /app

ARG PUBLIC_API_URL="/api"
ARG PUBLIC_BASE_PATH=""

ENV PUBLIC_API_URL=$PUBLIC_API_URL
ENV PUBLIC_BASE_PATH=$PUBLIC_BASE_PATH

COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ── Python Runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# Install system deps: curl for healthchecks, ffmpeg kept for future use
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl bash ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Backend application
COPY backend/app /app/app
COPY backend/alembic.ini /app/alembic.ini
COPY backend/alembic /app/alembic

# Frontend static build
COPY --from=frontend-builder /app/build /app/frontend/dist

ENV STATIC_DIR=/app/frontend/dist

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
