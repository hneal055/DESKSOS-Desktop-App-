# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json tsconfig.node.json ./
COPY vite.config.ts ./

RUN npm ci

COPY src ./src
COPY index.html ./

RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

CMD ["serve", "-s", "dist", "-l", "3000"]
