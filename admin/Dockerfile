# Static build + SPA server for the admin dashboard.
# VITE_* values are inlined at BUILD time — Railway passes service variables
# as Docker build args when they are declared as ARG here.
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Run stage: tiny static server with SPA fallback (BrowserRouter) ----
FROM node:20-alpine

WORKDIR /app
RUN npm install -g serve@14

COPY --from=build /app/dist ./dist
# serve reads its config from the directory it serves.
COPY serve.json ./dist/serve.json

EXPOSE 3000
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
