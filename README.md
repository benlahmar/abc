# esign-api — Signature électronique des documents universitaires

**Faculté des Sciences Ben M'Sick (FSBM), Université Hassan II de Casablanca**

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

### Vérifier la version qui tourne

http://localhost:8080/actuator/info affiche la date de construction de l'API. Si elle est ancienne après
un `git pull`, reconstruire l'image sans cache : `docker compose build --no-cache esign-api`, puis
`docker compose up --force-recreate`.

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
| `POST` | `/api/v1/batches/import`, `/api/v1/batches/apogee` | `documents:write` ou rôle `AGENT_SCOLARITE` |
| `GET` | `/api/v1/batches` (liste), `/api/v1/batches/{id}`, `/items`, `/report.csv`, `/archive.zip` | idem |
| `GET`, `POST` | `/api/v1/registry`, `/registry/import`, `/registry/students`, `/registry/students/{id}/block` | rôle `AGENT_SCOLARITE` |
| `DELETE` | `/api/v1/registry/{année}` (année close) | rôle `ESIGN_ADMIN` |
| `POST` | `/api/v1/apogee/documents` | `documents:write` ou rôle `AGENT_SCOLARITE` |
| `GET`, `POST` | `/api/v1/me/**` | rôle `ETUDIANT` (+ claim `cne`) |
| `GET`, `POST` | `/api/v1/student-requests/**` | `documents:write` ou rôle `AGENT_SCOLARITE` |
| `GET`, `PUT` | `/api/v1/admin/student-access[/{type}]` | rôle `ESIGN_ADMIN` |
| `GET` | `/api/v1/audit/verify`, `/api/v1/audit/events?type=`, `/api/v1/audit/documents/{id}` | `audit:read` ou rôle `ESIGN_ADMIN` |
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
| `etudiant` | `etudiant123` | `ETUDIANT` (CNE `R130456789`) |

Dans Swagger UI, **Authorize** → bloc `personne` (client `esign-swagger`, sans secret) → page de
connexion Keycloak. Le scénario complet est dans [`requests.http`](requests.http) (étapes 12 à 20).

## Données Apogée et traitements en masse

Deux sources, au choix ou ensemble :

| Source | Utilisation |
|---|---|
| **Export Apogée** (CSV ou Excel) | `POST /api/v1/batches/import` : toute une promotion à partir d'un fichier |
| **Vue Oracle d'Apogée** (lecture seule) | `POST /api/v1/apogee/documents` : **un** relevé, l'agent saisit seulement CNE + année + semestre<br>`POST /api/v1/batches/apogee` : toute une promotion (année, semestre, filière) |

Format attendu : **une ligne par étudiant et par module** (voir [`docs/modele-export-apogee.csv`](docs/modele-export-apogee.csv)).
Les lignes sont regroupées automatiquement en un relevé par étudiant/année/semestre (une attestation par
étudiant/année). Sont acceptés : séparateur `;` `,` ou tabulation, virgule décimale (`14,5`), dates
`14/05/2003` ou `2003-05-14`, année `2025` (COD_ANU) ou `2025-2026`, fichiers UTF-8 ou Windows-1252.

**Correspondance des colonnes** : si vos exports ou votre vue utilisent d'autres noms
(ex. `COD_NNE_IND`, `LIB_NOM_PAT_IND`, `COD_ANU`), il suffit de les indiquer, sans modifier le code :

```properties
APOGEE_COL_CNE=COD_NNE_IND
APOGEE_COL_NOM=LIB_NOM_PAT_IND
APOGEE_COL_ANNEE=COD_ANU
```

Les en-têtes de fichier sont reconnus sans tenir compte de la casse, des espaces ni des accents.

**Vue Oracle** : le contrat de la vue et le compte en lecture seule sont décrits dans
[`docs/vue-apogee.sql`](docs/vue-apogee.sql). Activation :

```properties
APOGEE_VIEW_ENABLED=true
APOGEE_VIEW_URL=jdbc:oracle:thin:@//serveur-apogee:1521/APOGEE
APOGEE_VIEW_USER=ESIGN_READER
APOGEE_VIEW_PASSWORD=...
APOGEE_VIEW_NAME=APOGEE.V_ESIGN_NOTES
APOGEE_VIEW_YEAR_FORMAT=START   # ANNEE = '2025' ; FULL si '2025-2026'
```

**Déroulement d'un traitement en masse** :

1. `dryRun=true` : vérification sans rien signer, erreurs listées **ligne par ligne**
   (ex. `ligne 6 : note manquante ou illisible « ABI » (module M51)`).
2. Lancement : réponse immédiate `202` ; le traitement se fait en arrière-plan.
3. Suivi : `GET /api/v1/batches/{id}` (signés, en erreur, restants), détail `GET /{id}/items?status=FAILED`.
4. Résultat : `GET /{id}/report.csv` (rapport ouvrable dans Excel) et `GET /{id}/archive.zip`
   (tous les PDF signés + le rapport).

Une ligne en erreur ne bloque pas les autres. Après un arrêt de l'application (même brutal), le traitement
**reprend automatiquement** au redémarrage, sans créer de doublon. Chaque document garde l'agent qui l'a
établi, et le circuit d'approbation paramétré s'applique aussi aux documents produits en masse.

## Accès étudiant (ENT, appli mobile, autres applications de la fac)

L'étudiant se connecte avec **son compte de l'université** (SSO Keycloak / CAS / LDAP). Son **CNE est lu
dans son jeton** (claim `cne`, attribut de l'annuaire) : il ne voit et ne demande que ses propres documents,
quelle que soit l'application utilisée.

| Méthode | Chemin | Rôle |
|---|---|---|
| `GET` | `/api/v1/me` | profil + documents demandables en ligne |
| `GET` | `/api/v1/me/documents`, `/api/v1/me/documents/{id}/download` | ses documents (signés, révoqués, en validation) |
| `POST`, `GET` | `/api/v1/me/requests` | demander un document, suivre ses demandes |

**Demande en ligne, paramétrable par type de document** (`PUT /api/v1/admin/student-access/{type}`) :

| Mode | Effet |
|---|---|
| `AGENT` (par défaut) | la demande arrive dans la file du service (`GET /api/v1/student-requests`) ; l'agent l'établit **depuis Apogée** en un clic (`/fulfill-from-apogee`) ou à partir des données saisies (`/fulfill`), ou la refuse avec un motif visible par l'étudiant (`/reject`) |
| `AUTO` | le document est produit **immédiatement** depuis la vue Apogée ; si les données manquent, la demande est « non aboutie » avec le motif |
| `DISABLED` | pas de demande en ligne (l'étudiant voit quand même ses documents) |

Une limite de demandes par jour et par type (`dailyLimit`) évite les abus. Les documents demandés en ligne
suivent le circuit d'approbation éventuellement paramétré.

### Intégrer dans l'ENT ou une autre application

1. **Le plus simple — lien vers le portail intégré** : `https://esign.universite.ma/etudiant/?sso=1`.
   L'étudiant déjà connecté à l'ENT (même SSO) arrive directement sur ses documents, sans ressaisir son
   mot de passe. Le portail fonctionne sur mobile et peut être ouvert dans un onglet ou une WebView.
2. **Intégration native** : l'application connecte l'étudiant via le SSO (OIDC), puis appelle
   `/api/v1/me/...` avec **le jeton de l'étudiant** (`Authorization: Bearer …`). Pour une application web
   appelant l'API depuis le navigateur, déclarer son origine :
   `ESIGN_CORS_ALLOWED_ORIGINS=https://ent.universite.ma,https://mobile.universite.ma`.
   Le fichier [`src/main/resources/static/etudiant/portail.js`](src/main/resources/static/etudiant/portail.js)
   sert d'exemple complet (connexion PKCE, liste, téléchargement, demande).

### Application « Mes documents officiels » (`/demandes`)

Application complète de demande d'attestations pour les étudiants : http://localhost:8080/demandes/?sso=1

- **Registre** de tous ses documents, regroupés par année universitaire, avec recherche (type, année,
  semestre, référence) et filtres « Prêts / En cours / Refusés ou annulés » ;
- **Aperçu du document** à côté du registre, avec son cachet : signé (violet), en attente (pointillés)
  ou annulé ; le PDF signé reste la seule version qui fait foi ;
- **Nouvelle demande** avec aperçu en direct, demandes restantes du jour, indication du délai
  (immédiat ou traité par la scolarité), détection d'un document identique déjà signé ou d'une
  demande identique en cours, et **5 secondes pour annuler l'envoi** ;
- **Suivi** de chaque demande étape par étape, motif de refus ou d'annulation, « Corriger et redemander » ;
- **Téléchargement**, copie du lien de vérification à transmettre à l'organisme destinataire ;
- Raccourcis clavier (`N` nouvelle demande, `/` recherche, `↑ ↓` parcourir, `T` télécharger, `?` aide),
  responsive (mobile : actions avant l'aperçu), mode sombre, mouvements réduits respectés.

**Mode démonstration**, sans serveur ni compte : http://localhost:8080/demandes/?demo, ou ouvrir
directement `src/main/resources/static/demandes/index.html` dans un navigateur.

Côté Keycloak, pour chaque application : un client OIDC, le rôle `ETUDIANT` pour les étudiants, et un
*mapper* qui place l'attribut `cne` du compte dans le jeton (voir `docker/keycloak/init-realm.sh`).
Compte de démonstration : `etudiant` / `etudiant123` (CNE `R130456789`).

## Back-office de la scolarité (`frontend/`)

Application web des agents de scolarité (Vite + React + TypeScript), servie sur
**http://localhost:8081** par `docker compose up --build` (service `backoffice`).
Connexion : `agent.apogee` / `agent123` pour les agents, `admin.esign` / `admin123` pour le paramétrage.

- **Demandes étudiantes** : file des demandes en attente (compteur dans la navigation), onglets
  Traitées / Refusées / En échec ; pour chaque demande :
  - **Établir depuis Apogée** (`A`, si la vue Oracle est activée) ;
  - **Saisir les données** (`S`) : formulaire prérempli, notes collables depuis Excel
    (code, module, note, crédits, résultat) dans un champ « Code », moyenne pondérée en direct ;
  - **Refuser** (`R`) avec des motifs prédéfinis ;
  - sélection multiple pour établir ou refuser en lot ; la demande suivante est sélectionnée automatiquement.
- **Documents** : recherche (nom, CNE, référence), filtres type / état / année, fiche, téléchargement (`T`),
  lien de vérification, aperçu, **historique d'audit**, révocation avec motif obligatoire,
  **Nouveau document** (`N`) hors demande.
- **Imports Apogée** : dépôt d'un export CSV/Excel (ou critères de la vue Oracle si elle est activée),
  **vérification sans signature** (lignes lues, documents prêts, erreurs ligne par ligne, aperçu des
  documents filtrable), confirmation, puis suivi en direct de la signature ; à la fin, PDF signés en ZIP
  (`T`), rapport CSV pour Excel, détail par document (erreurs, lien vers chaque document signé).
  Modèle de fichier téléchargeable depuis l'écran.
- **Registre des inscrits** : listes des inscrits par filière et par année (CSV ou Excel : CNE, nom,
  prénom, filière, niveau ; date et lieu de naissance facultatifs ; modèle téléchargeable). Chaque
  import est d'abord **comparé** à la liste en vigueur (arrivées, départs, changements de niveau ou
  de filière, lignes en erreur) ; il **remplace** ensuite la liste de chaque filière du fichier et
  il est refusé tant qu'une ligne est en erreur. Un agent peut **bloquer** un étudiant (transfert,
  annulation…) : le blocage survit aux imports. L'administrateur supprime les listes d'une année
  close (données personnelles).
- **Paramétrage** (rôle `ESIGN_ADMIN`, compte `admin.esign` / `admin123`) :
  - **Circuit de validation** par type de document : étapes ordonnées (rôle qui décide, condition
    *toujours* / *selon l'usage* / *sur demande*), simulation du parcours d'un document avant
    d'enregistrer, confirmation rédigée en clair ;
  - **Demandes en ligne** des étudiants : fermée, traitée par le service, immédiate depuis Apogée
    (si la vue Oracle est activée) ou, pour les **attestations** seulement, **immédiate depuis le
    registre des inscrits** : l'attestation est signée aussitôt si l'étudiant figure, non bloqué,
    dans la liste de l'année demandée ; sinon la demande va au service avec une note « à vérifier »
    (absent du registre, bloqué) visible des seuls agents. Nombre de demandes par jour ;
  - **Historique** des modifications (qui, quand, quoi), lu dans le journal d'audit.

- **Approbations** (validateurs : `vice.doyen` / `vicedoyen123`, `doyen` / `doyen123`) : documents
  en attente de leur décision selon le circuit, avec l'aperçu du PDF non signé, le déroulement du
  circuit (qui a approuvé, quand, avec quel commentaire) et ce que déclenche l'approbation (signature
  immédiate ou étape suivante) ; **Approuver** (`A`, commentaire facultatif, validation
  supplémentaire possible), **Refuser** (`R`, motif obligatoire), approbation **en lot** ; onglet
  **Mes décisions**. L'agent qui a établi un document ne peut pas l'approuver.

Les sections affichées dépendent des rôles du compte : agent de scolarité (demandes, documents,
imports), validateur (approbations), administrateur (paramétrage), ou plusieurs à la fois.

Les erreurs de validation de l'API sont affichées sous les champs concernés.

### Développement

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (API sur 8080, Keycloak sur 8180)
npm test               # tests unitaires (vitest)
npm run typecheck
npm run api:generate   # régénère les types depuis /v3/api-docs (API démarrée)
```

Organisation : `packages/api` (client typé), `packages/auth` (OIDC + PKCE, sans dépendance),
`packages/ui` (charte FSBM et composants), `apps/backoffice`. Les adresses de l'API et de Keycloak
sont lues dans `config.json` au démarrage ; dans l'image Docker, ce fichier est écrit à partir de
`ESIGN_API_URL`, `ESIGN_OIDC_ISSUER` et `ESIGN_OIDC_CLIENT_ID` (une même image pour tous les
environnements). L'origine du back-office doit figurer dans `ESIGN_CORS_ALLOWED_ORIGINS` de l'API,
et le client Keycloak public `esign-backoffice` doit autoriser son adresse de redirection.

## Identité de l'établissement

Le nom, la ville et le logo figurent sur les PDF, la page de vérification, les applications étudiant et la
page de connexion. Valeurs par défaut : FSBM, Université Hassan II de Casablanca, Casablanca, logo
`src/main/resources/static/branding/logo.png`. Pour un autre établissement :

```properties
ESIGN_UNIVERSITY=Université Hassan II de Casablanca
ESIGN_FACULTY=Faculté des Sciences Ben M'Sick
ESIGN_SHORT_NAME=FSBM
ESIGN_CITY=Casablanca
ESIGN_LOGO=file:/config/logo.png      # PNG, fond transparent de préférence ; vide = en-tête textuel
```

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
- [x] Import des exports Apogée (CSV/Excel) et lecture de la vue Oracle
- [x] Traitements en masse en arrière-plan, rapport, archive ZIP, reprise après arrêt
- [x] Accès étudiant : ses documents, demandes en ligne (AGENT/AUTO), portail intégrable dans l'ENT
- [ ] Webhooks `document.signed` vers les applications, notification de l'étudiant par e-mail
- [ ] Stockage objet S3/MinIO, conversion PDF/A-3
- [ ] Connecteur vers le système de scolarité (Apogée…), modèles personnalisables
- [x] Back-office scolarité : demandes étudiantes, documents (recherche, révocation, historique)
- [x] Back-office : imports Apogée (vérification, signature en masse, suivi, ZIP et rapport)
- [x] Back-office : paramétrage (circuit, demandes en ligne, historique)
- [x] Back-office : approbations (aperçu, décision, lot, historique des décisions)
- [x] Registre des inscrits : attestations immédiates sans la vue Oracle, avec comparaison, blocage et purge
- [ ] Back-office : audit
- [ ] SDK clients (générés depuis l'OpenAPI)

## Licences tierces

La police DejaVu Sans (`src/main/resources/fonts/`) est distribuée sous licence Bitstream Vera /
domaine public (voir `LICENSE-DejaVu.txt`).
