FROM python:3.11-slim-bookworm
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV FEED_RANKER_PORT=8092
EXPOSE 8092
# Tiny image — no torch/tensorflow
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8092"]
