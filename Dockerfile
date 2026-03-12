FROM node:20

# Cache bust
ARG CACHEBUST=1

WORKDIR /app

COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

RUN cd client && npm ci --include=dev
RUN cd server && npm ci --include=dev

COPY client/ ./client/
COPY server/ ./server/

RUN cd client && node node_modules/vite/bin/vite.js build
RUN cd server && npm run build

WORKDIR /app/server

EXPOSE 3001

CMD ["npm", "start"]