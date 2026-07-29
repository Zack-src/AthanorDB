FROM node:20-bookworm-slim

WORKDIR /app

# better-sqlite3 compiles a native addon at install time when no prebuilt
# binary matches this platform/arch — these make that always work rather
# than depending on prebuild-install's luck.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/dbml-engine/package.json packages/dbml-engine/package.json
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV ATHANORDB_DB_PATH=/data/athanordb.sqlite

VOLUME ["/data"]
EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
