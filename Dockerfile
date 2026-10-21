# Production image (SINALMAGAN: bu muhitda Docker mavjud emas edi)
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
COPY prisma prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
ENV UPLOAD_DIR=/data/uploads PORT=4000
EXPOSE 4000
VOLUME ["/data/uploads"]
CMD ["sh", "-c", "npx prisma migrate deploy && node server/dist/server.js"]
