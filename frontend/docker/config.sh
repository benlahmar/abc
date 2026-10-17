#!/bin/sh
# Écrit config.json à partir des variables d'environnement du conteneur (une même image pour
# tous les environnements).
set -e
cat > /usr/share/nginx/html/config.json <<JSON
{
  "apiUrl": "${ESIGN_API_URL:-http://localhost:8080}",
  "issuer": "${ESIGN_OIDC_ISSUER:-http://localhost:8180/realms/universite}",
  "clientId": "${ESIGN_OIDC_CLIENT_ID:-esign-backoffice}"
}
JSON
