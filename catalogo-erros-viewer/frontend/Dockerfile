FROM node:22-slim AS builder
WORKDIR /app
# BACKEND_INTERNAL_URL é usado dentro de next.config.mjs (rewrites), que o
# `next build` resolve em tempo de build (vira parte do routes-manifest) —
# precisa ser build arg, não só env var do container em runtime. Mesma
# pegadinha já documentada no erp_itp com NEXT_PUBLIC_*.
ARG BACKEND_INTERNAL_URL=http://localhost:8000
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["npm", "run", "start"]
