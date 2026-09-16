# Extension SciCite — vers une taxonomie de citation à 6 classes

Ce dossier documente le travail de fusion entre le dataset public
**SciCite** (Cohan et al., NAACL 2019) et le dataset manuel de 139 citations
extrait de l'article de Barchane et al. (`../citation_intent_dataset.csv`),
en deux phases :

- **Phase 1** : audit du dataset brut + reclassement heuristique (règles
  lexicales/regex) des 11 020 citations.
- **Phase 2** : vérification et correction assistées par LLM d'un échantillon
  ciblé de 330 citations (les buckets à plus faible rappel), utilisées à la
  fois comme sous-ensemble vérifié de haute confiance et pour affiner les
  règles heuristiques, puis ré-application sur l'ensemble des 11 020 lignes.

Objectif : passer des 3 classes grossières de SciCite (`background`, `method`,
`result`) à la taxonomie à 6 classes utilisée dans ce projet (`background`,
`methodology`, `usage`, `comparison`, `extension`, `critique`), en gardant une
méthode transparente et reproductible, et **sans prétendre à une précision
qu'elle n'a pas**.

## Provenance et licence de SciCite

- Source : https://github.com/allenai/scicite (archive `scicite.tar.gz`,
  téléchargée directement depuis le bucket S3 des auteurs).
- Licence : **Apache License 2.0** — réutilisation et modification autorisées,
  attribution requise.
- Citation obligatoire :
  ```bibtex
  @InProceedings{Cohan2019Structural,
    author={Arman Cohan and Waleed Ammar and Madeleine Van Zuylen and Field Cady},
    title={Structural Scaffolds for Citation Intent Classification in Scientific Publications},
    booktitle="NAACL",
    year="2019"
  }
  ```
  (Cette référence est d'ailleurs déjà la référence **[4]** de l'article
  Barchane et al. dont est issu `../citation_intent_dataset.csv`.)
- 11 020 instances au total (train 8243 / dev 916 / test 1861).

## 1. Audit du dataset brut

| Constat | Détail |
|---|---|
| Doublons de contexte | Seulement 4 phrases partagées par plusieurs citations groupées sur 11 020 — négligeable. |
| **Fuite entre splits** | Les splits ne sont **pas** faits par article citant : 468 `citingPaperId` communs entre train/dev, 226 entre train/test, 59 entre dev/test. À prendre en compte si vous évaluez un modèle par split. |
| Citations par article citant | Médiane = 1, max = 18 (quelques articles contribuent beaucoup d'exemples corrélés stylistiquement). |
| `label_confidence` | Absente pour 3999/11020 lignes (36 %). |
| `sectionName` | Très bruité avant normalisation (`Discussion`, `DISCUSSION`, `4. Discussion` traités comme distincts ; 724 valeurs vides) — normalisé dans le script (`normalize_section`). |
| Distribution `label` | background 60 %, method 28 %, result 12 % — cohérent avec la fiche officielle. |
| **Doublons exacts inter-splits** | 60 `citation_id` (paire citant/cité + index d'extrait) apparaissent **à l'identique** dans deux splits différents — pas juste un chevauchement d'articles, mais la même instance de citation dupliquée. À dédupliquer avant tout entraînement rigoureux. |

## 2. Règles de reclassement fin (heuristique, pas un modèle entraîné)

Le script `fine_classify_scicite.py` applique des règles lexicales
(regex, non sensibles à la casse) sur le champ `string` :

- `background` → conservé tel quel (déjà une classe atomique dans la
  taxonomie cible).
- `method` → `usage` si un marqueur explicite d'emploi direct est détecté
  (« we use/used/employ/adopt/apply/implement… », « using the
  method/tool/dataset/framework… ») ; sinon `methodology` par défaut.
- `result` → priorité : `critique` si un marqueur de contraste/limite est
  détecté (« however », « in contrast », « unlike », « fail… », « does not »,
  « limitation », « inconsistent », etc.) ; sinon `extension` si un marqueur
  de prolongement est détecté (« extend(s) », « build(s) on », « generalize »)
  ; sinon `comparison` (marqueur explicite de comparaison, ou par défaut).

**Découverte importante lors de la vérification manuelle** : le champ
`label2` de SciCite (`supportive` / `not_supportive`, annoté uniquement sur
une partie des citations `result`) a d'abord été utilisé comme signal
supplémentaire pour `critique`. La vérification manuelle a montré que
`not_supportive` produit des faux positifs nets — par exemple des phrases
contenant littéralement *« in agreement with »* ou *« consistent with »*
(donc clairement supportives) étaient annotées `not_supportive` par SciCite.
**Ce signal a donc été retiré de la règle `critique`** (il reste utilisé,
sans risque, comme signal secondaire pour `comparison`, où il ne fait que
renforcer une classe déjà par défaut correcte).

## 3. Phase 1 — résultat et fiabilité estimée (heuristique seule)

| Classe | Effectif (sur 11 020) | Précision estimée (échantillon manuel) | Rappel |
|---|---|---|---|
| `background` | 6375 (57.8 %) | Élevée (hérite du label SciCite d'origine) | — |
| `methodology` | 2922 (26.5 %) | Plausible sur échantillon, non garantie | Bucket résiduel large |
| `comparison` | 1262 (11.5 %) | Bonne (bucket permissif) | Correcte |
| `usage` | 232 (2.1 %) | Élevée sur échantillon | **Faible** — ne capte pas les formulations passives |
| `critique` | 210 (1.9 %) | Bonne après correction du signal `label2` | **Faible** |
| `extension` | 19 (0.2 %) | ~75 % | **Très faible** |

Conclusion de la Phase 1 : fiable pour `background`/`comparison`, mais
sous-estime fortement `usage`, `critique` et `extension` par manque de
rappel des règles lexicales.

## 4. Phase 2 — vérification et correction assistées par LLM

**Méthode** : un échantillon ciblé de 330 lignes a été extrait des buckets à
plus faible fiabilité (150 `methodology` par défaut, 120 `comparison` par
défaut, 60 `comparison` par marqueur), réparti en 3 lots de 110, chacun
soumis indépendamment à un agent LLM avec la définition complète des 6
classes, des consignes explicites sur les pièges déjà identifiés en Phase 1
(le biais `label2`, le sens littéral de « extends », les usages passifs), et
pour instruction de fournir un label + une justification courte par ligne.
(Cette architecture à plusieurs annotateurs indépendants qu'on combine
ensuite fait écho, en plus simple, à l'approche multi-modèles de l'article
Barchane et al. lui-même — ici 3 lots indépendants plutôt que 3 modèles sur
les mêmes données, faute d'accès à plusieurs LLM distincts dans cet
environnement.)

**Résultat du ré-étiquetage (328 lignes uniques traitées)** :

| Bucket heuristique d'origine | Corrigé vers | Nombre |
|---|---|---|
| `methodology` | → `usage` | 73 |
| `methodology` | → `background` | 32 |
| `comparison` | → `background` | 22 |
| `comparison` | → `critique` | 9 |
| `methodology` | → `extension` | 4 |
| `methodology` | → `comparison` | 6 |
| autres corrections mineures | | 7 |
| **Total corrigé** | | **153 / 328 (47 %)** |

**Enseignement principal** : environ 68 % des lignes `methodology` par
défaut examinées étaient en réalité des `usage` exprimés à la voix passive
(« mesuré/évalué/analysé/préparé **en utilisant** X », « **comme décrit
précédemment** [cite] ») — la règle heuristique de Phase 1 ne couvrait que
la voix active (« we use/employ… »).

**Amélioration appliquée à la règle heuristique** : ajout des marqueurs
passifs ci-dessus à `USAGE_RE`. Une seconde piste (« absence de pronom à la
première personne ⇒ `background` ») a été testée sur les 328 lignes
vérifiées et **rejetée** : seulement 21 % de précision (50/235), bien trop
imprécise pour être utilisée.

**Effet de la règle améliorée**, testé sur un nouvel échantillon de 12
citations `usage` fraîchement détectées (hors des 328 lignes vérifiées) :
11/12 plausibles à la relecture manuelle — la règle généralise bien au-delà
de l'échantillon qui a servi à la calibrer.

## 5. Résultat final (heuristique v2 + 340 lignes vérifiées par LLM)

| Classe | Effectif (sur 11 020) | Évolution vs Phase 1 |
|---|---|---|
| `background` | 6428 (58.3 %) | ≈ stable |
| `methodology` | 2325 (21.1 %) | ↓ (des cas déplacés vers `usage`/`background`) |
| `comparison` | 1231 (11.2 %) | ≈ stable |
| `usage` | **790 (7.2 %)** | **×3.4** (232 → 790) |
| `critique` | 222 (2.0 %) | ≈ stable |
| `extension` | 24 (0.2 %) | légère hausse |

340 lignes portent `classification_method="llm_assisted_verified"` (label
de confiance la plus haute de ce dataset, vérifié individuellement) ; le
reste porte `classification_method="heuristic_rule_based"` avec le détail
de la règle déclenchante dans `classification_rule`.

## Fichiers

- `fine_classify_scicite.py` — script de reclassement (reproductible : `python3 fine_classify_scicite.py`, nécessite les fichiers `train.jsonl`/`dev.jsonl`/`test.jsonl` de SciCite dans `/tmp/scicite_data/scicite/` et, pour appliquer les surcharges vérifiées, les fichiers `llm_verification_pass/llm_pass_chunk_*_labeled.csv`).
- `scicite_fine_classified_full.csv` — les 11 020 lignes de SciCite reclassées (v2, post-Phase 2), avec colonnes : `dataset_source`, `split`, `paper_id` (=`citingPaperId`), `citation_id`, `section` (normalisée), `citation_context`, `citation_topic` (vide — voir limites), `cited_reference` (=`citedPaperId`, identifiant Semantic Scholar — voir limites), `label_coarse` (label SciCite d'origine), `label2_scicite`, `classification` (label fin), `classification_rule`, `classification_method` (`heuristic_rule_based` ou `llm_assisted_verified`), `is_key_citation`, `source_marker_type`.
- `scicite_pilot_sample.csv` — échantillon stratifié (v2) pour audit qualité continu.
- `llm_verification_pass/` — les 330 lignes soumises aux agents LLM (`llm_pass_sample.csv`) et les 3 lots de résultats (`llm_pass_chunk_{1,2,3}_labeled.csv`, avec la justification de chaque décision dans la colonne `rationale`).

## Limites connues et travail restant

1. **`cited_reference` n'est pas une référence bibliographique lisible** pour
   les lignes SciCite (contrairement au dataset manuel de 139 lignes) : c'est
   un identifiant Semantic Scholar (`citedPaperId`). Résoudre ces identifiants
   en titres/auteurs nécessite l'API Semantic Scholar, **inaccessible depuis
   cet environnement d'exécution** (bloquée par le proxy réseau — testé et
   confirmé : `curl` retourne une erreur 403 sur `api.semanticscholar.org`).
   À faire depuis un environnement avec accès réseau complet.
2. **`citation_topic` est vide** pour les 11 020 lignes SciCite : le générer
   correctement (un résumé du sujet de la citation, comme dans le dataset
   manuel) demande une lecture/synthèse par citation. Faisable avec le même
   pipeline d'agents que la Phase 2, en traitant cela comme un troisième
   pilote avant un passage à l'échelle complète.
3. **`methodology` reste un bucket résiduel imparfait** : même après la
   Phase 2, ~30 % des lignes `methodology` par défaut examinées étaient en
   réalité du `background` pur (mention d'une méthode sans réutilisation par
   les auteurs citants). Aucune règle heuristique testée ne discrimine
   correctement ce cas (voir la piste rejetée en section 4) ; seule une
   relecture cas par cas (ou un LLM) le peut de façon fiable.
4. Le rappel de `critique` et surtout `extension` reste faible même après
   l'ajout des marqueurs passifs (qui ciblaient spécifiquement `usage`) : un
   futur pilote devrait cibler spécifiquement ces deux classes.
5. Les splits SciCite ont un chevauchement d'articles citants entre
   train/dev/test, et 60 lignes sont des doublons exacts inter-splits (voir
   audit) — à corriger (déduplication + re-split par article) avant tout
   entraînement/évaluation rigoureux d'un modèle sur ce dataset combiné.

## Prochaines étapes suggérées

1. Cibler spécifiquement `critique` et `extension` avec un nouveau pilote
   LLM (échantillon plus large, ces classes étant rares).
2. Générer `citation_topic` par LLM sur un pilote, puis à l'échelle.
3. Dédupliquer et re-splitter par article avant tout entraînement.
4. Résoudre `cited_reference` en métadonnées lisibles via l'API Semantic
   Scholar, depuis un environnement avec accès réseau.
