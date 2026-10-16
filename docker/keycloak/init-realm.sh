#!/bin/bash
# Configuration Keycloak de démonstration.
# Idempotent : relancé à chaque "docker compose up", il crée ce qui manque et réapplique
# la configuration des clients (scopes, origines CORS) même si le realm existe déjà.
set -euo pipefail
KC=/opt/keycloak/bin/kcadm.sh
REALM=universite
# Origines autorisées à demander un jeton depuis le navigateur (Swagger UI)
WEB_ORIGINS='["http://localhost:8080","http://127.0.0.1:8080"]'

$KC config credentials --server http://keycloak:8080 --realm master --user admin --password admin

if ! $KC get "realms/$REALM" >/dev/null 2>&1; then
  $KC create realms -s realm=$REALM -s enabled=true
fi

# scope_id <nom> : identifiant du client scope (bash pur, l'image Keycloak n'a pas awk)
scope_id() {
  local id name
  while IFS=, read -r id name; do
    if [[ "$name" == "$1" ]]; then
      echo "$id"
      return
    fi
  done < <($KC get client-scopes -r $REALM --fields id,name --format csv --noquotes)
}

for scope in documents:write documents:read documents:revoke documents:admin audit:read workflow:admin; do
  if [[ -z "$(scope_id "$scope")" ]]; then
    $KC create client-scopes -r $REALM -s name="$scope" -s protocol=openid-connect \
      -s 'attributes."include.in.token.scope"=true' -s 'attributes."display.on.consent.screen"=false'
  fi
done

# client <clientId> <secret> <scopes...> : crée le client s'il manque, puis applique sa configuration
client() {
  local client_id=$1 secret=$2
  shift 2
  local cid
  cid=$($KC get clients -r $REALM -q clientId="$client_id" --fields id --format csv --noquotes)
  if [[ -z "$cid" ]]; then
    $KC create clients -r $REALM -s clientId="$client_id" -s enabled=true -s publicClient=false \
      -s serviceAccountsEnabled=true -s standardFlowEnabled=false -s directAccessGrantsEnabled=false \
      -s secret="$secret"
    cid=$($KC get clients -r $REALM -q clientId="$client_id" --fields id --format csv --noquotes)
  fi
  $KC update "clients/$cid" -r $REALM -s secret="$secret" -s "webOrigins=$WEB_ORIGINS"
  for scope in "$@"; do
    $KC update "clients/$cid/default-client-scopes/$(scope_id "$scope")" -r $REALM
  done
  echo "Client $client_id configuré"
}

# Service de scolarité : délivre, consulte et révoque
client scolarite-app scolarite-secret-dev documents:write documents:read documents:revoke
# ENT / portail étudiant : peut seulement demander et télécharger des attestations
client ent-app ent-secret-dev documents:write documents:read
# Contrôle interne : journal d'audit et tous les documents
client audit-app audit-secret-dev audit:read documents:admin

# ---------------------------------------------------------------- personnes (démonstration)

# Rôles métier du realm : ils figurent dans le jeton (realm_access.roles) et sont utilisés par l'API
for role in AGENT_SCOLARITE VICE_DOYEN_PEDAGOGIE DOYEN ESIGN_ADMIN; do
  if ! $KC get "roles/$role" -r $REALM >/dev/null 2>&1; then
    $KC create roles -r $REALM -s name=$role
  fi
done

# user <login> <mot de passe> <prénom> <nom> <rôles...>
user() {
  local login=$1 password=$2 first=$3 last=$4
  shift 4
  local uid
  uid=$($KC get users -r $REALM -q username="$login" -q exact=true --fields id --format csv --noquotes)
  if [[ -z "$uid" ]]; then
    $KC create users -r $REALM -s username="$login" -s enabled=true -s emailVerified=true \
      -s firstName="$first" -s lastName="$last" -s email="$login@universite.test"
  fi
  $KC set-password -r $REALM --username "$login" --new-password "$password"
  for role in "$@"; do
    $KC add-roles -r $REALM --uusername "$login" --rolename "$role"
  done
  echo "Utilisateur $login configuré"
}

user agent.apogee agent123 Karim Bennani AGENT_SCOLARITE
user vice.doyen vicedoyen123 Samira Alaoui VICE_DOYEN_PEDAGOGIE
user doyen doyen123 Ahmed Tazi DOYEN
user admin.esign admin123 Admin Esign ESIGN_ADMIN

# Client public pour la connexion des personnes depuis Swagger UI (authorization code + PKCE)
SWAGGER_REDIRECTS='["http://localhost:8080/swagger-ui/oauth2-redirect.html","http://127.0.0.1:8080/swagger-ui/oauth2-redirect.html"]'
cid=$($KC get clients -r $REALM -q clientId=esign-swagger --fields id --format csv --noquotes)
if [[ -z "$cid" ]]; then
  $KC create clients -r $REALM -s clientId=esign-swagger -s enabled=true -s publicClient=true \
    -s standardFlowEnabled=true -s directAccessGrantsEnabled=true -s serviceAccountsEnabled=false
  cid=$($KC get clients -r $REALM -q clientId=esign-swagger --fields id --format csv --noquotes)
fi
$KC update "clients/$cid" -r $REALM -s "redirectUris=$SWAGGER_REDIRECTS" -s "webOrigins=$WEB_ORIGINS" \
  -s 'attributes."pkce.code.challenge.method"=S256'
echo "Client esign-swagger configuré"

echo "Realm $REALM configuré"
