FROM node:20-alpine

WORKDIR /app

# Copy and build client
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# Copy and build server
COPY server/package*.json ./server/
RUN cd server && npm install

COPY server/ ./server/
RUN cd server && npm run build

WORKDIR /app/server

EXPOSE 3001

CMD ["npm", "start"]