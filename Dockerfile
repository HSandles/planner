FROM node:20

WORKDIR /app

# Copy everything first
COPY client/ ./client/
COPY server/ ./server/

# Build client (force install dev deps since vite is a devDependency)
RUN cd client && npm install --include=dev && npm run build

# Build server
RUN cd server && npm install --include=dev && npm run build

WORKDIR /app/server

EXPOSE 3001

CMD ["npm", "start"]