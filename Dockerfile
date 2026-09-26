# Build stage: compile the Vite/React app to static files.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve stage: nginx serving the static build. No server-side state —
# all progress (XP, supplies, review schedule, badges) lives in the
# browser's localStorage, so this image is stateless and needs no volumes.
FROM nginx:alpine AS serve

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
