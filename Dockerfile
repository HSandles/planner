FROM node:20-alpine

WORKDIR /app

# Copy everything first
COPY client/ ./client/
COPY server/ ./server/

# Build client
RUN cd client && npm install && npm run build

# Build server
RUN cd server && npm install && npm run build

WORKDIR /app/server

EXPOSE 3001

CMD ["npm", "start"]