# Dataset d'extraction et de classification des citations

Ce dataset a été construit manuellement à partir de l'article scientifique :

> Barchane, M.; Belefqih, S.; Ben Lahmar, E.H.; Zahour, O.; Zellou, A.
> **"Citation Intent Classification via Exponential Borda Fusion and SciBERT."**
> *Algorithms* 2026, 19, 612. https://doi.org/10.3390/a19080612

Chaque citation dans le texte (marqueurs `[n]`, `[n,m]`, `[n–m]`) a été repérée,
mise en correspondance avec sa référence bibliographique complète, puis
classifiée selon le rôle rhétorique qu'elle joue dans la phrase où elle apparaît.
Le contexte (phrase citante) et un résumé du sujet abordé sont également fournis.

## Fichiers

- `citation_intent_dataset.csv` / `citation_intent_dataset.json` — le dataset final.
- `build_dataset.py` — script Python qui a servi à générer les deux fichiers
  ci-dessus à partir de l'annotation manuelle (liste `INSTANCES`). Relancer
  `python3 build_dataset.py` régénère les fichiers à l'identique.

## Schéma des données

Une ligne = **une paire (occurrence de citation dans le texte, référence citée)**.
Quand un marqueur regroupe plusieurs références (ex. `[15,17,21–24]`), il est
éclaté en autant de lignes, chacune partageant le même contexte/topic mais
pointant vers une référence bibliographique différente — c'est la convention
utilisée par les corpus de référence du domaine (SciCite, ACL-ARC, unarXive).

| Colonne             | Description                                                                 |
|---------------------|------------------------------------------------------------------------------|
| `paper_id`          | Identifiant de l'article source (`algorithms-19-00612`)                     |
| `citation_id`       | Identifiant unique de la ligne dans le dataset                              |
| `section`           | Section de l'article où apparaît la citation                                |
| `in_text_marker`    | Marqueur de citation original dans le texte (ex. `[1,4,5]`)                  |
| `cited_ref_number`  | Numéro de la référence dans la bibliographie de l'article                   |
| `cited_reference`   | Référence bibliographique complète (auteurs, titre, venue, année)           |
| `classification`    | Rôle rhétorique de la citation (voir taxonomie ci-dessous)                   |
| `citation_context`  | Phrase(s) exacte(s) contenant la citation                                   |
| `citation_topic`    | Résumé court du sujet/thème abordé par la citation                          |

## Taxonomie de classification

L'article étudié définit lui-même une taxonomie en 5 classes pour la
classification d'intention de citation (c'est d'ailleurs le sujet de l'étude).
Nous reprenons cette taxonomie et lui ajoutons une 6ᵉ classe `usage` pour
distinguer les cas où un artefact précis (dataset, modèle, outil, échelle de
mesure) de la référence citée est directement réutilisé dans l'étude —
ce qui correspond à la notion d'« utilisation » demandée :

| Classe        | Définition                                                                                          |
|---------------|-------------------------------------------------------------------------------------------------------|
| `background`  | Contexte général, motivation ou connaissance préalable ; la référence appuie une affirmation sans être reprise, comparée ou remise en cause directement. |
| `methodology` | La méthode, théorie ou formalisme de la référence est directement adapté(e) ou repris(e) dans l'approche proposée. |
| `usage`       | Un artefact précis de la référence (dataset, modèle, outil, taxonomie, échelle) est directement employé dans l'étude. |
| `comparison`  | La référence (ou ses résultats) est mise en contraste ou comparée à une autre approche, un autre dataset, ou aux résultats propres de l'article. |
| `extension`   | L'article étend explicitement, prolonge ou généralise un cadre/une idée introduit(e) dans la référence (souvent un travail antérieur des mêmes auteurs). |
| `critique`    | La référence, ou le phénomène qu'elle documente, présente une limite, une faiblesse ou un problème qui motive l'étude actuelle. |

## Statistiques

- 80 occurrences de citation distinctes dans le texte
- 139 lignes (paires citation × référence) après éclatement des groupes multi-références
- Répartition des classes : `background` (75), `comparison` (30), `methodology` (13),
  `critique` (10), `usage` (7), `extension` (4)

## Méthodologie et limites

L'extraction et la classification ont été réalisées **manuellement** par lecture
complète du texte (introduction, related work, méthodologie, expérimentation,
discussion, conclusion) et de la bibliographie (62 références), en s'appuyant
sur le sens de chaque phrase citante. Il ne s'agit donc pas d'une extraction
automatique par NLP : c'est une annotation experte, reproductible et
vérifiable via le texte source (`Read` du PDF), mais elle reste soumise à
l'interprétation d'un seul annotateur. Pour un usage en production (entraînement
de modèle à plus grande échelle), on pourrait :

1. Automatiser l'extraction des marqueurs `[n]` par regex sur le texte complet.
2. Utiliser un pipeline LLM multi-modèle (à l'image de la méthode Borda décrite
   dans l'article lui-même) pour proposer une classification, puis la faire
   valider par des annotateurs humains.
3. Étendre l'approche à un corpus de plusieurs articles pour obtenir un dataset
   d'entraînement de taille significative.
