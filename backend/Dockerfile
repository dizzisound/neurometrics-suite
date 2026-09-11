# 1. Fase di compilazione (Build Stage)
FROM node:24-alpine3.23 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Fase di esecuzione (Production Stage)
FROM node:24-alpine3.23
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Installiamo solo le dipendenze di produzione, escludendo quelle di sviluppo per leggerezza e sicurezza
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/app.js"]