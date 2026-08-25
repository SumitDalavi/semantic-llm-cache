FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci --only=production=false

COPY src ./src
RUN npm run build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

RUN mkdir -p logs

ENV NODE_ENV=production
EXPOSE 4000 9090

CMD ["node", "dist/index.js"]
