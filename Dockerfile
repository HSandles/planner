FROM node:20

WORKDIR /app

# Copy package files first for better caching
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

# Install dependencies
RUN cd client && npm ci --include=dev
RUN cd server && npm ci --include=dev

# Copy source files
COPY client/ ./client/
COPY server/ ./server/

# Build
RUN cd client && npm run build
RUN cd server && npm run build

WORKDIR /app/server

EXPOSE 3001

CMD ["npm", "start"]