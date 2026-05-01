# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
ARG HEROUI_AUTH_TOKEN
COPY package*.json ./
RUN npm ci

FROM deps AS build
ARG HEROUI_AUTH_TOKEN
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM deps AS frontend-build
ARG HEROUI_AUTH_TOKEN
COPY . .
RUN npm run build:frontend

FROM nginx:1.29-alpine AS frontend
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist/client /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "dist/server/index.js"]
