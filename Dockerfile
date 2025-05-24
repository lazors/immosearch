FROM node:24

# Install dependencies for running Chrome
RUN apt-get update && apt-get install -y \
    xvfb \
    dbus \
    dbus-x11 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/node/app

COPY package*.json ./
RUN npm install

# Install Playwright & browsers
RUN npx playwright install --with-deps chromium

COPY . .

# Create startup script
RUN echo '#!/bin/bash\n\
    # Start dbus\n\
    mkdir -p /var/run/dbus\n\
    dbus-daemon --system --fork\n\
    \n\
    # Start Xvfb\n\
    Xvfb :99 -screen 0 1920x1080x24 -ac &\n\
    \n\
    # Wait for Xvfb to be ready\n\
    sleep 2\n\
    \n\
    # Set display\n\
    export DISPLAY=:99\n\
    \n\
    # Run the application\n\
    exec node --no-warnings --loader ts-node/esm check-immo-scout.ts' > /home/node/app/start.sh

RUN chmod +x /home/node/app/start.sh

# Run the start script
CMD ["/home/node/app/start.sh"]
