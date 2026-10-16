#!/bin/bash
# Configuration Keycloak de démonstration (idempotente).
set -euo pipefail
KC=/opt/keycloak/bin/kcadm.sh
REALM=universite

$KC config credentials --server http://keycloak:8080 --realm master --user admin --password admin

if $KC get "realms/$REALM" >/dev/null 2>&1; then
  echo "Realm $REALM déjà configuré"
  exit 0
fi

$KC create realms -s realm=$REALM -s enabled=true

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

for scope in documents:write documents:read documents:revoke documents:admin audit:read; do
  $KC create client-scopes -r $REALM -s name="$scope" -s protocol=openid-connect \
    -s 'attributes."include.in.token.scope"=true' -s 'attributes."display.on.consent.screen"=false'
done

# create_client <clientId> <secret> <scopes...>
create_client() {
  local client_id=$1 secret=$2
  shift 2
  $KC create clients -r $REALM -s clientId="$client_id" -s enabled=true -s publicClient=false \
    -s serviceAccountsEnabled=true -s standardFlowEnabled=false -s directAccessGrantsEnabled=false \
    -s secret="$secret"
  local cid
  cid=$($KC get clients -r $REALM -q clientId="$client_id" --fields id --format csv --noquotes)
  for scope in "$@"; do
    $KC update "clients/$cid/default-client-scopes/$(scope_id "$scope")" -r $REALM
  done
}

# Service de scolarité : délivre, consulte et révoque
create_client scolarite-app scolarite-secret-dev documents:write documents:read documents:revoke
# ENT / portail étudiant : peut seulement demander et télécharger des attestations
create_client ent-app ent-secret-dev documents:write documents:read
# Contrôle interne : journal d'audit et tous les documents
create_client audit-app audit-secret-dev audit:read documents:admin

echo "Realm $REALM configuré"
