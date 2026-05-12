# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_IDLE_TIMEOUT_MS=1800000
ENV VITE_IDLE_TIMEOUT_MS=${VITE_IDLE_TIMEOUT_MS}

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------- Runtime stage (Nginx) ----------
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
