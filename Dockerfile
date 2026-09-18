FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y \
        ffmpeg \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

RUN python3 -m venv /opt/whisper

RUN /opt/whisper/bin/pip install --no-cache-dir openai-whisper

COPY . .

EXPOSE 8080

CMD ["node", "processor.js"]
