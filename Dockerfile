# AppBey Production Dockerfile (Node.js + TypeScript)
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy required source files explicitly
COPY tsconfig.json ./
COPY server.ts ./
COPY frontend ./frontend

# Build bundled production server
RUN npm run build

# Expose port
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]

