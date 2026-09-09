FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/data /seed-data
COPY docker-entrypoint.sh /usr/local/bin/petals-start

RUN chmod +x /usr/local/bin/petals-start && mkdir -p /app/data

EXPOSE 3000
ENTRYPOINT ["petals-start"]
CMD ["npm", "run", "start"]
