# esign-api — Signature électronique des documents universitaires

API REST (Spring Boot 4) qui **génère** et **signe électroniquement** les attestations de scolarité
et les relevés de notes, avec une **signature électronique avancée au format PAdES** (certificat X.509),
et permet à n'importe qui de **vérifier** l'authenticité d'un document via son QR code.

Elle est conçue pour être intégrée dans les autres applications de la faculté (ENT, scolarité, Moodle,
application mobile…) via OAuth2.

## Fonctionnalités

| Fonction | Détail |
|---|---|
| Génération PDF | Attestation de scolarité, relevé de notes (moyenne pondérée par crédits, multi-pages), police embarquée |
| Signature | PAdES (ETSI EN 319 142) via [EU DSS](https://github.com/esig/dss) 6.5, apparence visible, niveaux B / T / LT / LTA |
| Clé privée | Fichier PKCS#12 **ou HSM PKCS#11** (la clé ne quitte jamais le token) |
| QR code | Intégré **avant** la signature, renvoie vers la page publique de vérification |
| Vérification publique | Par référence (`GET /verify/{code}` en HTML, `/api/v1/verify/{code}` en JSON) ou par dépôt du PDF (empreinte + validation DSS) |
| Révocation | Le document reste signé, mais la vérification indique qu'il n'est plus valable |
| Idempotence | En-tête `Idempotency-Key` : un nouvel envoi de la même requête ne crée jamais de doublon |
| Sécurité | OAuth2 / JWT (Keycloak…), scopes par application, cloisonnement des documents par client |
| Audit | Journal chaîné par empreintes SHA-256 (toute altération est détectable) |
| Documentation | OpenAPI 3 + Swagger UI (`/swagger-ui.html`) |

## Architecture

```
Apps clientes (ENT, scolarité, Moodle…)
        │  OAuth2 client_credentials → JWT (scopes)
        ▼
┌──────────────────────── esign-api ────────────────────────┐
│ DocumentController ─► DocumentService                      │
│                        ├─ PdfRenderer (PDFBox + QR code)   │
│                        ├─ PadesSigningService (EU DSS)  ───┼──► PKCS#12 / HSM PKCS#11
│                        ├─ DocumentStorage (PDF signés)     │      (+ TSA RFC 3161 si B-T+)
│                        └─ AuditService (chaîne de hash)    │
│ VerificationController (public) ─► PadesValidationService  │
└──────────────────────────────┬─────────────────────────────┘
                               ▼
                          PostgreSQL (registre + audit, Flyway)
```

```
src/main/java/com/universite/esign
├── config/        propriétés, sécurité OAuth2, OpenAPI
├── document/      entité, service, API /documents et /templates
├── pdf/           génération des PDF et QR code
├── signature/     PAdES (signature, validation), token PKCS#12/PKCS#11, PKI de dev
├── verification/  vérification publique (JSON + page HTML)
├── audit/         journal d'audit chaîné
├── storage/       stockage des PDF signés
└── common/, web/  utilitaires, gestion des erreurs (RFC 9457)
```

## Démarrage rapide

Prérequis : Java 21+, Maven 3.9+.

```bash
mvn test                                   # 9 tests d'intégration (signature + validation réelles)
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

Le profil `dev` utilise H2 en mémoire et **génère une PKI de test** dans `./data/dev-pki/`
(AC racine + certificat de cachet). Swagger : http://localhost:8080/swagger-ui.html

### Avec Docker (PostgreSQL + Keycloak + API)

```bash
docker compose up --build
```

Keycloak (http://localhost:8180, admin/admin) est configuré automatiquement avec le realm `universite`
et trois applications clientes de démonstration :

| Client | Secret | Scopes |
|---|---|---|
| `scolarite-app` | `scolarite-secret-dev` | `documents:write documents:read documents:revoke` |
| `ent-app` | `ent-secret-dev` | `documents:write documents:read` |
| `audit-app` | `audit-secret-dev` | `audit:read documents:admin` |

### Tester avec Swagger UI

1. Ouvrir http://localhost:8080/swagger-ui.html (utiliser `localhost` ou `127.0.0.1`, origines autorisées par Keycloak).
2. **Authorize** → bloc `oauth2` : `client_id` = `scolarite-app`, `client_secret` = `scolarite-secret-dev`,
   cocher les scopes → **Authorize**.
3. En cas de « Failed to fetch » : le realm Keycloak n'autorise pas l'origine du navigateur (CORS).
   Relancer `docker compose up` (le script d'init réapplique la configuration) ou utiliser le bloc
   `bearerAuth` en y collant un jeton obtenu avec `requests.http` ou curl.

Le fichier [`requests.http`](requests.http) (IntelliJ, ou VS Code + extension REST Client) contient un
scénario complet : jeton, attestation, relevé, téléchargement, vérification, révocation, audit.

## Utilisation de l'API

```bash
# 1. Jeton de l'application cliente
TOKEN=$(curl -s -X POST http://localhost:8180/realms/universite/protocol/openid-connect/token \
  -d grant_type=client_credentials -d client_id=scolarite-app -d client_secret=scolarite-secret-dev \
  | jq -r .access_token)

# 2. Relevé de notes signé
curl -s -X POST http://localhost:8080/api/v1/documents \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: releve-R130456789-S5-2025" \
  -d '{
    "type": "RELEVE_NOTES",
    "student": { "cne": "R130456789", "nom": "El Amrani", "prenom": "Yasmine",
                 "filiere": "SMI", "niveau": "Licence 3" },
    "academicYear": "2025-2026",
    "semester": "S5",
    "grades": [
      { "code": "M51", "intitule": "Réseaux informatiques", "note": 14.5, "credits": 6 },
      { "code": "M52", "intitule": "Bases de données avancées", "note": 9.25, "credits": 6 }
    ],
    "issuedBy": { "id": "agent.apogee", "name": "Karim Bennani" }
  }'

# 3. Téléchargement du PDF signé
curl -s -H "Authorization: Bearer $TOKEN" -o releve.pdf \
  http://localhost:8080/api/v1/documents/{id}/download

# 4. Vérification publique (sans jeton)
curl -s http://localhost:8080/api/v1/verify/{verificationCode}
curl -s -F file=@releve.pdf http://localhost:8080/api/v1/verify
```

| Méthode | Chemin | Scope |
|---|---|---|
| `POST` | `/api/v1/documents` | `documents:write` |
| `GET` | `/api/v1/documents/{id}` | `documents:read` |
| `GET` | `/api/v1/documents/{id}/download` | `documents:read` |
| `POST` | `/api/v1/documents/{id}/revoke` | `documents:revoke` |
| `GET` | `/api/v1/templates` | authentifié |
| `GET` | `/api/v1/audit/verify`, `/api/v1/audit/documents/{id}` | `audit:read` |
| `GET`, `PUT` | `/api/v1/admin/workflows[/{type}]` | `workflow:admin` ou rôle `ESIGN_ADMIN` |
| `GET` | `/api/v1/approvals`, `/api/v1/approvals/{id}/preview` | personne connectée (rôle de l'étape) |
| `POST` | `/api/v1/approvals/{id}/approve`, `/reject` | personne connectée (rôle de l'étape) |
| `GET` | `/verify/{code}` (HTML), `/api/v1/verify/{code}` | public |
| `POST` | `/api/v1/verify` (multipart `file`) | public |

Une application ne voit que les documents qu'elle a créés, sauf avec le scope `documents:admin`.

## Traçabilité de l'agent

Chaque document enregistre **la personne qui l'a établi** (`issuedBy`), en plus de l'application :

| Appel | Identité enregistrée | `issuedBy.source` |
|---|---|---|
| L'agent est connecté avec son compte (jeton utilisateur, rôle `AGENT_SCOLARITE`) | Celle du jeton (le champ `issuedBy` de la requête est ignoré) | `AUTHENTICATED` |
| Une application (ex. Apogée) appelle avec son jeton `client_credentials` | Celle déclarée dans `issuedBy` (**obligatoire**) | `DECLARED` |

La révocation suit la même règle (champ `by`). Toutes les actions figurent dans le journal d'audit
(`agent.apogee (déclaré via apogee-app)`, `vice.doyen (authentifié via approbation)`…).

## Circuit d'approbation paramétrable

Par défaut, **aucun circuit** : les données venant d'Apogée sont déjà validées et les documents sont
signés immédiatement. Si l'organisation change, un administrateur (rôle `ESIGN_ADMIN`) ajoute des étapes
par type de document, **sans modifier le code** :

```http
PUT /api/v1/admin/workflows/RELEVE_NOTES
{
  "steps": [
    { "name": "Validation du vice-doyen à la pédagogie", "role": "VICE_DOYEN_PEDAGOGIE",
      "condition": "IF_PURPOSE", "purposes": ["ETRANGER"] },
    { "name": "Validation du doyen (sur demande)", "role": "DOYEN", "condition": "IF_ESCALATED" }
  ]
}
```

| Condition | L'étape s'applique… |
|---|---|
| `ALWAYS` | toujours |
| `IF_PURPOSE` | si l'usage déclaré du document (`purpose`, ex. `ETRANGER`) est dans `purposes` |
| `IF_ESCALATED` | si l'agent (`"escalate": true` à la création) ou un validateur précédent demande une validation supplémentaire |

Déroulement :

1. Le document est établi au statut `PENDING_APPROVAL` (ni téléchargeable, ni vérifiable publiquement).
2. Chaque validateur connecté avec son compte voit ses dossiers (`GET /api/v1/approvals`), prévisualise
   le PDF (`/preview`), puis approuve ou rejette (`/approve`, `/reject` avec motif).
3. Après la dernière approbation, le document est **signé automatiquement** ; un rejet le passe en `REJECTED`.

Règles : seul le rôle de l'étape en cours peut décider ; une application ne peut pas approuver ; l'agent
qui a établi un document ne peut pas l'approuver ; un changement de circuit ne concerne que les nouvelles
demandes. Les personnes ne sont jamais écrites dans le circuit, seulement des **rôles** Keycloak.

### Comptes de démonstration (Docker)

| Login | Mot de passe | Rôle |
|---|---|---|
| `agent.apogee` | `agent123` | `AGENT_SCOLARITE` |
| `vice.doyen` | `vicedoyen123` | `VICE_DOYEN_PEDAGOGIE` |
| `doyen` | `doyen123` | `DOYEN` |
| `admin.esign` | `admin123` | `ESIGN_ADMIN` |

Dans Swagger UI, **Authorize** → bloc `personne` (client `esign-swagger`, sans secret) → page de
connexion Keycloak. Le scénario complet est dans [`requests.http`](requests.http) (étapes 12 à 20).

## Passage en production

1. **Certificat** : obtenir un certificat de **cachet électronique** de l'établissement auprès d'un
   prestataire de services de confiance (au Maroc : prestataire agréé selon la loi 43-20 ; en UE : eIDAS).
2. **HSM** : stocker la clé dans un HSM et configurer le token PKCS#11 :
   ```properties
   ESIGN_TOKEN_TYPE=PKCS11
   ESIGN_PKCS11_LIBRARY=/usr/lib/libpkcs11.so
   ESIGN_PKCS11_SLOT_INDEX=0
   ESIGN_PKCS11_PIN=...            # depuis un coffre de secrets, jamais en clair dans le dépôt
   ```
   (Pour un fichier `.p12` : `ESIGN_P12_PATH`, `ESIGN_P12_PASSWORD`, `ESIGN_P12_ALIAS`.)
3. **Horodatage et validité long terme** : `ESIGN_SIGNATURE_LEVEL=PAdES_BASELINE_LT` (ou `LTA`) et
   `ESIGN_TSA_URL=https://tsa.prestataire.example`. Les données de révocation (OCSP/CRL) sont alors
   intégrées : la signature reste vérifiable après l'expiration du certificat.
4. **Ancres de confiance** : `ESIGN_VALIDATION_TRUSTED_CERTIFICATES=/pki/ac-racine.pem`.
5. **Infra** : `ESIGN_PUBLIC_BASE_URL` (URL imprimée dans le QR code), HTTPS, rate limiting sur
   `/verify` (API gateway), sauvegardes de la base et des PDF, désactivation de Swagger si besoin
   (`springdoc.swagger-ui.enabled=false`).
6. **Données personnelles** : déclaration auprès de l'autorité compétente (CNDP au Maroc / RGPD en UE).
   Le registre ne conserve que le minimum (CNE, nom, type, empreinte) ; les notes ne sont jamais
   exposées par la vérification publique.

> **Note sur la validation** : avec la PKI de test, DSS renvoie `INDETERMINATE`
> (`CERTIFICATE_CHAIN_GENERAL_FAILURE`), car le certificat de test n'a pas de service de révocation.
> La signature est néanmoins **intacte** (`cryptographicallyValid: true`). Avec un certificat d'un
> prestataire et le niveau B-LT, le résultat attendu est `TOTAL_PASSED`.

## Feuille de route

- [x] MVP : attestation + relevé, PAdES, QR code, vérification, révocation, audit, OAuth2
- [x] Traçabilité de l'agent qui établit / révoque chaque document
- [x] Circuit d'approbation paramétrable (désactivé par défaut)
- [ ] Authentification forte (OTP) des validateurs, à activer dans Keycloak
- [ ] Notifications aux validateurs (e-mail) et webhooks vers les applications
- [ ] Signature en masse asynchrone (fin de semestre) + webhooks `document.signed`
- [ ] Stockage objet S3/MinIO, conversion PDF/A-3
- [ ] Connecteur vers le système de scolarité (Apogée…), modèles personnalisables
- [ ] SDK clients (générés depuis l'OpenAPI)

## Licences tierces

La police DejaVu Sans (`src/main/resources/fonts/`) est distribuée sous licence Bitstream Vera /
domaine public (voir `LICENSE-DejaVu.txt`).
