FROM node:24-alpine
WORKDIR /app/mail-relay
COPY mail-relay/package*.json ./
RUN npm ci --omit=dev && mkdir -p /data/receipts && chown -R node:node /data
COPY mail-relay/server.mjs mail-relay/contracts.mjs ./
COPY supabase/functions/_shared/contracts.mjs /app/supabase/functions/_shared/contracts.mjs
USER node
ENV PORT=8080 RELAY_STORE_DIR=/data/receipts
EXPOSE 8080
CMD ["node","server.mjs"]
