#!/bin/sh
# Écrit le config.json de chaque application à partir des variables d'environnement du conteneur
# (une même image pour tous les environnements).
set -e
API="${ESIGN_API_URL:-http://localhost:8080}"
ISSUER="${ESIGN_OIDC_ISSUER:-http://localhost:8180/realms/universite}"

cat > /usr/share/nginx/backoffice/config.json <<JSON
{
  "apiUrl": "$API",
  "issuer": "$ISSUER",
  "clientId": "${ESIGN_BACKOFFICE_CLIENT_ID:-${ESIGN_OIDC_CLIENT_ID:-esign-backoffice}}"
}
JSON

cat > /usr/share/nginx/etudiant/config.json <<JSON
{
  "apiUrl": "$API",
  "issuer": "$ISSUER",
  "clientId": "${ESIGN_STUDENT_CLIENT_ID:-esign-etudiant}",
  "university": "${ESIGN_UNIVERSITY:-Université Hassan II de Casablanca}",
  "faculty": "${ESIGN_FACULTY:-Faculté des Sciences Ben M'Sick}",
  "shortName": "${ESIGN_SHORT_NAME:-FSBM}",
  "city": "${ESIGN_CITY:-Casablanca}"
}
JSON
