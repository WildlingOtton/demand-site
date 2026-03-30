FROM node:22-alpine

WORKDIR /app

# Install full deps for build, then prune to prod deps.
COPY package*.json ./
RUN npm ci

# Copy source and build frontend assets.
COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
