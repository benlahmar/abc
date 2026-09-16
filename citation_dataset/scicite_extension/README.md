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
| **Doublons de `citation_id`** | 60 `citation_id` dupliqués au total. **Correction d'une erreur de documentation précédente** : ce ne sont pas 60 doublons inter-splits. En réalité : **9** sont de vrais doublons inter-splits (la même citation apparaît dans deux splits différents — fuite réelle) ; les **51** autres sont dans le **même** split et ne diffèrent que par un artefact d'encodage (mojibake, ex. « Griffith's » vs « Griffith‚Äôs ») sur la même phrase — un bug d'export du corpus, pas un doublon sémantique. **Dédupliqué** dans `scicite_fine_classified_full.csv` (11 020 → 10 960 lignes), en gardant la copie sans artefact d'encodage quand elle existe. |

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

## 5. Phase 3 — chasse ciblée aux `critique`/`extension` cachés dans `comparison`

**Constat de départ** : après la Phase 2, 1076 lignes restaient classées
`comparison` par la seule heuristique (non vérifiées), la majorité issues
du label `result` de SciCite sans marqueur lexical fort. Comme `critique`
et `extension` ne peuvent provenir que de ce label, c'est le seul réservoir
où en chercher davantage.

**Méthode** : échantillon stratifié de 300 lignes (100 par lot), 3 agents
indépendants, consigne resserrée sur la précision (« la plupart des lignes
sont déjà correctement `comparison`, ne signalez `critique`/`extension` que
si l'évidence textuelle est claire — ignorez les différences numériques
neutres »).

**Résultat** : 45/300 lignes corrigées (15 %) :

| Nouvelle classe | Nombre | Exemples de formulations manquées par le regex |
|---|---|---|
| `critique` | 27 | « contrary to », « conflicting results », « not consistent with », « opposite trend », « contrasts findings », « comes with its own challenges », « not particularly useful » |
| `extension` | 4 | « an improvement of the original X technique », généralisation d'un effet à un nouveau domaine sans le mot « extend » |
| `usage` | 6 | dataset/benchmark repris directement (ex. FedBench, données de Rosengaus et al.) |
| `background` | 6 | contexte de littérature pur, sans lien direct avec les résultats propres |
| `methodology` | 2 | approche adaptée « similaire à celles appliquées dans des études précédentes » |

**Règles regex ajoutées à `CRITIQUE_RE`** (testées avant intégration :
7/8 = 87,5 % de précision sur les 300 lignes) : « contrary to », « conflicting »,
« not consistent with », « opposite (trend|effect|results) ».
Les cas d'`extension` (seulement 4 trouvés) restent trop rares et trop
idiosyncratiques pour en tirer une règle regex fiable — cette classe reste
la plus dépendante d'un passage LLM complet.

**Vérification finale (nouvel échantillon, non calibré dessus)** : sur 10
lignes `critique` fraîchement détectées, 8 sont clairement correctes, mais
**2 faux positifs confirmés** : « did not differ… a finding **consistent
with** previous studies » et « However, similar to our results… » sont
déclenchés par « did not »/« however » alors que la suite de la phrase est
en réalité supportive. **Ce biais résiduel est documenté, pas corrigé** :
distinguer ces cas demanderait de comprendre la portée sémantique de la
proposition qui suit le connecteur, hors de portée d'un regex.

## 6. Phase 4 — chasse élargie sur `extension` + re-split par article

**Pourquoi** : après la Phase 3, `extension` restait la classe la plus
fragile (27 cas sur 10 960, 0,2 %) — trop peu d'exemples trouvés pour en
tirer une règle regex fiable. Plutôt que de traiter les 10 960 lignes par
LLM (disproportionné : ~100 lots d'agents), un pilote élargi ciblé de 500
lignes (5 lots de 100) a été tiré des bassins `methodology` et `comparison`
non encore vérifiés (250 de chaque), avec une consigne spécifiquement
orientée « cherchez `extension` en priorité ».

**Résultat** : 203/500 lignes corrigées (41 %), dont **12 nouvelles
`extension`** (2,4 % du bucket testé — un taux bien supérieur aux 0,2 %
de base, confirmant que la classe était sévèrement sous-détectée), plus de
nombreux `usage`/`critique`/`background` supplémentaires trouvés au passage.
Formulations typiques manquées par le regex : « builds upon X », « was
refined by X », « generalising previously obtained results in X », « model
may be expanded to include… », « adapted procedures used for… » (application
à un nouveau domaine).

**Re-split par article** (`resplit_by_paper.py`) : les splits SciCite
d'origine mélangeaient les citations d'un même article citant entre
train/dev/test (fuite documentée en section 1). Un nouveau re-split
déterministe (hash du `paper_id`) regroupe désormais toutes les citations
d'un même article dans un seul split, aux mêmes proportions que l'original
(74,8 % / 8,3 % / 16,9 %). **Fuite vérifiée nulle** après re-split, et la
distribution des 6 classes reste stable entre les nouveaux splits (pas de
biais introduit). Le résultat est ajouté en tant que nouvelle colonne
`split_resplit_by_paper` ; la colonne `split` d'origine (avec fuite) est
conservée pour référence/comparaison.

**⚠️ Ordre d'exécution important** : `resplit_by_paper.py` doit être lancé
*après* `fine_classify_scicite.py`, car ce dernier régénère le fichier CSV
en entier et écraserait la colonne de re-split si l'ordre était inversé.

## 7. Résultat final (heuristique v4 + 1128 lignes vérifiées par LLM + dédoublonnage + re-split)

| Classe | Effectif (sur 10 960, dédoublonné) | Évolution vs Phase 1 |
|---|---|---|
| `background` | 6495 (59.3 %) | ≈ stable |
| `methodology` | 2140 (19.5 %) | ↓ (cas déplacés vers `usage`/`background`) |
| `comparison` | 1131 (10.3 %) | ↓ (cas déplacés vers `critique`/`extension`) |
| `usage` | **873 (8.0 %)** | **×3.8** (232 → 873) |
| `critique` | **282 (2.6 %)** | **+34 %** (210 → 282) |
| `extension` | **39 (0.4 %)** | **×2.1** (19 → 39) |

1128 `citation_id` uniques portent `classification_method="llm_assisted_verified"`
(trois passages combinés : 328 lignes Phase 2 + 300 lignes Phase 3 + ~500
lignes Phase 4, avec recouvrements résolus par le dédoublonnage) ; le reste
porte `classification_method="heuristic_rule_based"` avec le détail de la
règle déclenchante dans `classification_rule`.

**Ce qui reste non résolu** : même après 3 passages LLM ciblés couvrant
~1150 lignes vérifiées sur 10 960 (~10 %), `extension` reste minoritaire
(0,4 %) et son vrai taux de base dans le corpus complet est inconnu — les
échantillons ciblés sur-représentent les buckets où on s'attend à en
trouver, donc ce chiffre ne doit pas être lu comme une estimation fiable de
la prévalence réelle d'`extension` dans les 90 % de lignes non vérifiées.

## Fichiers

- `fine_classify_scicite.py` — script de reclassement (reproductible : `python3 fine_classify_scicite.py`, nécessite les fichiers `train.jsonl`/`dev.jsonl`/`test.jsonl` de SciCite dans `/tmp/scicite_data/scicite/` et, pour appliquer les surcharges vérifiées, les fichiers `llm_verification_pass/llm_pass_chunk_*_labeled.csv`, `llm_verification_pass_2/ce_hunt_chunk_*_labeled.csv` et `llm_verification_pass_3/ext_hunt_chunk_*_labeled.csv`).
- `resplit_by_paper.py` — re-split déterministe par article citant, à lancer après `fine_classify_scicite.py` (voir avertissement ci-dessus).
- `scicite_fine_classified_full.csv` — les 10 960 lignes de SciCite reclassées et dédoublonnées (v4), avec colonnes : `dataset_source`, `split` (original, avec fuite — conservé pour référence), `split_resplit_by_paper` (re-split sans fuite, à préférer), `paper_id` (=`citingPaperId`), `citation_id`, `section` (normalisée), `citation_context`, `citation_topic` (vide — voir limites), `cited_reference` (=`citedPaperId`, identifiant Semantic Scholar — voir limites), `label_coarse` (label SciCite d'origine), `label2_scicite`, `classification` (label fin), `classification_rule`, `classification_method` (`heuristic_rule_based` ou `llm_assisted_verified`), `is_key_citation`, `source_marker_type`.
- `scicite_pilot_sample.csv` — échantillon stratifié (v4) pour audit qualité continu.
- `llm_verification_pass/` — Phase 2 : 330 lignes soumises aux agents LLM (`llm_pass_sample.csv`) et les 3 lots de résultats (`llm_pass_chunk_{1,2,3}_labeled.csv`).
- `llm_verification_pass_2/` — Phase 3 : les 3 lots de résultats de la chasse ciblée `critique`/`extension` (`ce_hunt_chunk_{1,2,3}_labeled.csv`, avec justification par ligne dans `rationale`).
- `llm_verification_pass_3/` — Phase 4 : les 5 lots de résultats de la chasse élargie sur `extension` (`ext_hunt_chunk_{1..5}_labeled.csv`).

## Limites connues et travail restant

1. **`cited_reference` n'est pas une référence bibliographique lisible** pour
   les lignes SciCite (contrairement au dataset manuel de 139 lignes) : c'est
   un identifiant Semantic Scholar (`citedPaperId`). Résoudre ces identifiants
   en titres/auteurs nécessite l'API Semantic Scholar, **inaccessible depuis
   cet environnement d'exécution** (bloquée par le proxy réseau — testé et
   confirmé : `curl` retourne une erreur 403 sur `api.semanticscholar.org`).
   À faire depuis un environnement avec accès réseau complet.
2. **`citation_topic` est vide** pour les 10 960 lignes SciCite : le générer
   correctement (un résumé du sujet de la citation, comme dans le dataset
   manuel) demande une lecture/synthèse par citation. Faisable avec le même
   pipeline d'agents que les Phases 2/3, en traitant cela comme un nouveau
   pilote avant un passage à l'échelle complète.
3. **`methodology` reste un bucket résiduel imparfait** : ~30 % des lignes
   `methodology` par défaut examinées en Phase 2 étaient en réalité du
   `background` pur (mention d'une méthode sans réutilisation par les
   auteurs citants). Aucune règle heuristique testée ne discrimine
   correctement ce cas (voir la piste rejetée en section 4) ; seule une
   relecture cas par cas (ou un LLM) le peut de façon fiable.
4. **`critique` garde un biais résiduel connu et non corrigé** : les
   connecteurs « however » et « did not » déclenchent parfois `critique` à
   tort quand la proposition qui suit est en fait supportive (« did not
   differ… consistent with previous studies ») — voir section 5. Ce n'est
   pas corrigible par regex sans analyse sémantique de la portée du
   connecteur.
5. **`extension` reste la classe la plus fragile** (39 cas sur 10 960,
   0,4 %) : même après trois passages LLM ciblés (~1150 lignes vérifiées),
   trop peu d'exemples ont été trouvés pour dériver des règles lexicales
   fiables, et son taux réel dans les ~90 % de lignes jamais vérifiées reste
   inconnu (les échantillons ciblés sur-représentent les buckets où on
   s'attend à en trouver — ne pas extrapoler 0,4 % comme prévalence
   générale). Seul un passage LLM complet sur l'ensemble du corpus (pas un
   échantillon) donnerait un rappel et une estimation de prévalence fiables.
6. ~~Les splits SciCite ont un chevauchement d'articles citants entre
   train/dev/test~~ — **résolu en Phase 4** par `resplit_by_paper.py`
   (colonne `split_resplit_by_paper`, fuite vérifiée nulle).

## Prochaines étapes suggérées

1. Passage LLM complet (pas un échantillon) sur l'ensemble du corpus pour
   obtenir un rappel et une prévalence fiables sur `extension`.
2. Générer `citation_topic` par LLM sur un pilote, puis à l'échelle.
3. Résoudre `cited_reference` en métadonnées lisibles via l'API Semantic
   Scholar, depuis un environnement avec accès réseau.
4. Corriger le biais résiduel « however »/« did not » de `critique` (section 5) —
   nécessiterait un modèle plutôt qu'un regex pour juger la portée sémantique
   de la proposition qui suit le connecteur.
