# syntax=docker/dockerfile:1

# Build
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# Deps de producao (sem devDependencies)
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Producao
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules

EXPOSE 3001
CMD ["node", "dist/src/main.js"]
