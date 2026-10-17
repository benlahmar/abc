# Back-office FSBM : construction Vite puis service statique par nginx.
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/ui/package.json packages/ui/
COPY apps/backoffice/package.json apps/backoffice/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/config.sh /docker-entrypoint.d/40-esign-config.sh
COPY --from=build /src/apps/backoffice/dist /usr/share/nginx/html
RUN chmod +x /docker-entrypoint.d/40-esign-config.sh
EXPOSE 80
