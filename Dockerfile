# WoundScan, full stack: FastAPI + onnxruntime + the built website, in one container.
#   docker build -t woundscan .
#   docker run -p 7860:7860 -e DATABASE_URL=postgresql://... woundscan      (SQLite on /data when DATABASE_URL is unset)
# Model weights are not in the Git repository (non-commercial training data). Put them in ./models before building:
#   models/wound_seg.onnx, models/wound_seg_medetec_adapted_320.onnx, models/type/type_cls.onnx, models/type/type_cls.json
# Without them the server still starts and answers 503 with a clear message.

FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PORT=7860 WOUNDSCAN_DB=/data/woundscan.db
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install -r server/requirements.txt
COPY server/app server/app
COPY server/run.py server/run.py
COPY src/woundscan src/woundscan
COPY models models
COPY --from=web /web/dist web/dist
RUN useradd -m -u 1000 user && mkdir -p /data && chown -R user /data /app
USER user
WORKDIR /app/server
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD python -c "import urllib.request,os;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','7860')+'/api/health',timeout=4)"
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860} --proxy-headers --forwarded-allow-ips='*'"]
