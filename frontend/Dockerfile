# Applications web FSBM (back-office et espace étudiant) : construction Vite, puis service statique par nginx.
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/ui/package.json packages/ui/
COPY apps/backoffice/package.json apps/backoffice/
COPY apps/etudiant/package.json apps/etudiant/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/spa.inc /etc/nginx/conf.d/spa.inc
COPY docker/config.sh /docker-entrypoint.d/40-esign-config.sh
COPY --from=build /src/apps/backoffice/dist /usr/share/nginx/backoffice
COPY --from=build /src/apps/etudiant/dist /usr/share/nginx/etudiant
RUN chmod +x /docker-entrypoint.d/40-esign-config.sh
# 80 : back-office ; 8082 : espace étudiant
EXPOSE 80 8082
