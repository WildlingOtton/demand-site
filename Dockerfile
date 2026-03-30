FROM node:22-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# SQLite data directory
RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "index.js"]
