# syntax=docker/dockerfile:1

# Build
FROM node:24-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_COLETOR_TOKEN
ARG NEXT_PUBLIC_CHAMADA_TOKEN
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_COLETOR_TOKEN=$NEXT_PUBLIC_COLETOR_TOKEN
ENV NEXT_PUBLIC_CHAMADA_TOKEN=$NEXT_PUBLIC_CHAMADA_TOKEN
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
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=prod-deps /app/node_modules ./node_modules

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
