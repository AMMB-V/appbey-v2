# AppBey Production Dockerfile (Node.js + TypeScript)
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY server.ts ./
COPY frontend ./frontend

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
