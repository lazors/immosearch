FROM node:24-slim AS base

RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates fonts-liberation libappindicator3-1 \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 \
    libxdamage1 libxrandr2 xdg-utils libu2f-udev libvulkan1 libdrm2 \
    libgbm1 libxshmfence1 libxss1 libpci3 libx11-dev libgtk-3-0 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /home/node/app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx playwright install --with-deps chromium

FROM base AS production

RUN npm run build


ENV NODE_PATH=./build

CMD ["npx", "ts-node", "check-immo-scout.ts"]
