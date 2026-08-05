FROM python:3.11-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# CPU torch index for Contabo/VPS
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV GUARDIAN_HOST=0.0.0.0 \
    GUARDIAN_PORT=8091 \
    GUARDIAN_ENABLE_WHISPER=true \
    GUARDIAN_ENABLE_NUDENET=true \
    GUARDIAN_ENABLE_CLIP=true \
    GUARDIAN_WHISPER_MODEL=base \
    GUARDIAN_WHISPER_DEVICE=cpu \
    GUARDIAN_WHISPER_COMPUTE=int8

EXPOSE 8091

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091"]
