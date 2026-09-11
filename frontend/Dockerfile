# 1. Fase di compilazione (Build Stage)
FROM node:24-alpine3.23 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Fase di esecuzione con Nginx (Production Stage)
FROM nginx:alpine
# Copiamo i file compilati da Angular nella cartella pubblica di Nginx
COPY --from=builder /app/dist/neurometrics-frontend/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]