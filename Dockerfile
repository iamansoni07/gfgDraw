# ==========================================
# GFG Draw — Multi-Stage Production Dockerfile
# ==========================================

# Stage 1: Build Frontend Static Bundle
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend ./
RUN npm run build

# Stage 2: Build Server
FROM node:22-alpine AS server-builder
WORKDIR /app/server

COPY server/package.json ./
RUN npm install

COPY server ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/gfgdraw.db

# Install curl for container health check
RUN apk add --no-cache curl

# Copy compiled server
COPY server/package.json ./
RUN npm install --omit=dev

COPY --from=server-builder /app/server/dist ./dist

# Copy built frontend assets into server public directory
COPY --from=frontend-builder /app/frontend/dist ./public

# Prepare persistent data volume
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "--experimental-sqlite", "dist/index.js"]

