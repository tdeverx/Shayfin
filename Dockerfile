# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
	&& npm prune --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	SHAYFIN_DATA_DIR=/data

RUN addgroup --system --gid 10001 shayfin \
	&& adduser --system --uid 10001 --ingroup shayfin --home /app --disabled-password shayfin \
	&& mkdir -p /app /data \
	&& chown -R shayfin:shayfin /app /data

WORKDIR /app

COPY --from=build --chown=shayfin:shayfin /app/build ./build
COPY --from=build --chown=shayfin:shayfin /app/node_modules ./node_modules
COPY --from=build --chown=shayfin:shayfin /app/package.json ./package.json

USER shayfin

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health/live').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "build"]
