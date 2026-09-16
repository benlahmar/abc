# Extension SciCite — vers une taxonomie de citation à 6 classes

Ce dossier documente la Phase 1 du travail de fusion entre le dataset public
**SciCite** (Cohan et al., NAACL 2019) et le dataset manuel de 139 citations
extrait de l'article de Barchane et al. (`../citation_intent_dataset.csv`).

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

## 3. Résultat et fiabilité estimée (après vérification manuelle par classe)

| Classe | Effectif (sur 11 020) | Règle déclenchante | Précision estimée (échantillon manuel) | Rappel |
|---|---|---|---|---|
| `background` | 6375 (57.8 %) | héritée telle quelle | Élevée (hérite du label SciCite d'origine) | — |
| `methodology` | 2922 (26.5 %) | défaut (aucun marqueur d'usage direct) | Plausible sur échantillon, non garantie | Bucket résiduel large |
| `comparison` | 1262 (11.5 %) | marqueur explicite ou défaut `result` | Bonne (bucket permissif, les faux positifs y sont peu graves) | Correcte |
| `usage` | 232 (2.1 %) | marqueur explicite d'emploi direct | Élevée sur échantillon (5/5 corrects) | **Faible** — ne capte pas les formulations passives (« is commonly used ») |
| `critique` | 210 (1.9 %) | marqueur lexical de contraste/limite | Bonne après correction (8/8 plausibles sur l'échantillon relu) | **Faible** — beaucoup de critiques n'emploient pas ces mots-clés |
| `extension` | 19 (0.2 %) | marqueur lexical (« extend », « generalize ») | ~75 % (2 faux positifs sur 8 : sens littéral/anatomique de « extends », ou « generalizable » utilisé hors contexte de prolongement) | **Très faible** |

**Conclusion honnête** : ce pipeline heuristique est un point de départ
transparent et audité, pas un classifieur fiable pour la production. Il
est fiable pour `background`/`comparison`, correct mais bruité pour
`methodology`, et **sous-estime fortement** `usage`, `critique` et surtout
`extension` (faible rappel — beaucoup de vrais cas ne contiennent pas les
mots-clés attendus).

## Fichiers

- `fine_classify_scicite.py` — script de reclassement (reproductible : `python3 fine_classify_scicite.py`, nécessite les fichiers `train.jsonl`/`dev.jsonl`/`test.jsonl` de SciCite dans `/tmp/scicite_data/scicite/`, à adapter selon l'emplacement local).
- `scicite_fine_classified_full.csv` — les 11 020 lignes de SciCite reclassées, avec colonnes : `dataset_source`, `split`, `paper_id` (=`citingPaperId`), `citation_id`, `section` (normalisée), `citation_context`, `citation_topic` (vide — voir limites ci-dessous), `cited_reference` (=`citedPaperId`, un identifiant Semantic Scholar, pas une référence bibliographique complète — voir limites), `label_coarse` (label SciCite d'origine), `label2_scicite`, `classification` (label fin), `classification_rule` (règle ayant déclenché la classe), `classification_method="heuristic_rule_based"`, `is_key_citation`, `source_marker_type`.
- `scicite_pilot_sample.csv` — échantillon stratifié de 319 lignes (jusqu'à 60 par classe fine) destiné à la vérification manuelle/l'audit qualité ; c'est sur cet échantillon qu'a porté la relecture manuelle résumée ci-dessus.

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
   manuel) demande une lecture/synthèse par citation — infaisable à la main
   à cette échelle, et une génération automatique par mots-clés serait de
   mauvaise qualité. Recommandation : le faire via un modèle de langage
   (résumé court par citation), en traitant cela comme un second pilote
   avant un passage à l'échelle complète.
3. **Le rappel de `usage`, `critique` et `extension` est faible** : ces
   heuristiques lexicales ratent la majorité des formulations implicites
   (voix passive, synonymes non couverts par les regex). Un second passage
   avec un LLM (ou plusieurs, comme dans la méthode Borda de l'article
   Barchane et al. lui-même) donnerait un bien meilleur rappel, au prix d'un
   coût de calcul et d'un besoin de validation humaine sur un échantillon.
4. Les splits SciCite ont un chevauchement d'articles citants entre
   train/dev/test (voir audit) — à corriger (re-split par article) avant tout
   entraînement/évaluation rigoureux d'un modèle sur ce dataset combiné.

## Prochaine étape suggérée

Un second pilote LLM-assisté sur les buckets `methodology` (défaut, 2922
lignes) et `comparison`/`extension`/`critique` pour améliorer le rappel des
classes rares, avec vérification humaine sur un sous-échantillon stratifié
(comme celui déjà fourni ici), avant tout passage à l'échelle sur les 11 020
lignes.
