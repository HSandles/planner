FROM node:20

WORKDIR /app

# Copy package files
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

# Install dependencies
RUN cd client && npm ci --include=dev
RUN cd server && npm ci --include=dev

# Copy source files
COPY client/ ./client/
COPY server/ ./server/

# Build client using node to call vite directly
RUN cd client && node node_modules/vite/bin/vite.js build

# Build server
RUN cd server && npm run build

WORKDIR /app/server

EXPOSE 3001

CMD ["npm", "start"]