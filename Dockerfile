# Build AppBey with the complete locked dependency set.
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY tsconfig.json ./
COPY server.ts ./
COPY frontend ./frontend
RUN npm run build

# Keep build tools and type packages out of the production image.
FROM node:20-alpine AS runtime
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/frontend ./frontend

ENV NODE_ENV=production
ENV PORT=3000
USER node
EXPOSE 3000

CMD ["npm", "start"]
