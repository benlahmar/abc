#!/usr/bin/env python3
"""Build the citation-intent dataset extracted from
Barchane et al., "Citation Intent Classification via Exponential Borda
Fusion and SciBERT", Algorithms 2026, 19, 612.
"""
import csv
import json

PAPER_ID = "algorithms-19-00612"
PAPER_DOI = "10.3390/a19080612"

REFERENCES = {
1: "Visser, R.; Dunaiski, M. Sentiment and intent classification of in-text citations using BERT. EPiC Ser. Comput. 2022, 85, 129-145.",
2: "Barchane, M.; Zahour, O. Assessing the Quality of Scientific Publications: A Thorough Analysis of Citation-Based and Content-Oriented Metrics for Evaluating Research Impact and Scholarly Contribution. Math. Model. Comput. 2025, 12, 1109-1120.",
3: "Paolini, L.; Vahdati, S.; Di Iorio, A.; Wardenga, R.; Heibi, I.; Peroni, S. \"Why do you cite?\" An investigation on Citation Intents and Decision-Making Classification Processes. arXiv 2024, arXiv:2407.13329.",
4: "Cohan, A.; Ammar, W.; van Zuylen, M.; Cady, F. Structural Scaffolds for Citation Intent Classification in Scientific Publications. NAACL-HLT 2019, pp. 3586-3596.",
5: "Mifrah, S.; Hourrane, O.; Benlahmar, E.H.; Bouhriz, N.; Rachdi, M. Citation Sentiment Analysis: A Brief Comprehensive Study. J. Islam. Ctries. Soc. Stat. Sci. 2018, 3, 145-156.",
6: "Zheng, M.; Shen, D.; Shen, Y.; Chen, W.; Xiao, L. Improving Self-supervised Pre-training via a Fully-Explored Masked Language Model. arXiv 2020, arXiv:2010.06040.",
7: "Shui, Z.; Karypis, P.; Karls, D.S.; Wen, M.; Manchanda, S.; Tadmor, E.B.; Karypis, G. Fine-Tuning Language Models on Multiple Datasets for Citation Intention Classification. arXiv 2024, arXiv:2410.13332.",
8: "Faerber, M.; Jatowt, A. Citation recommendation: Approaches and datasets. Int. J. Digit. Libr. 2020, 21, 375-405.",
9: "Gu, N.; Gao, Y.; Hahnloser, R.H.R. Local Citation Recommendation with Hierarchical-Attention Text Encoder and SciBERT-based Reranking. arXiv 2022, arXiv:2112.01206.",
10: "Devlin, J.; Chang, M.W.; Lee, K.; Toutanova, K. BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding. arXiv 2019, arXiv:1810.04805.",
11: "Rogers, A.; Kovaleva, O.; Rumshisky, A. A Primer in BERTology: What we know about how BERT works. arXiv 2020, arXiv:2002.12327.",
12: "Beltagy, I.; Lo, K.; Cohan, A. SciBERT: A Pretrained Language Model for Scientific Text. EMNLP-IJCNLP 2019, pp. 3615-3620.",
13: "Cohan, A.; Goharian, N. Contextualizing Citations for Scientific Summarization using Word Embeddings and Domain Knowledge. SIGIR 2017, pp. 1133-1136.",
14: "Huang, J.; Chang, K.C.C. Citation: A Key to Building Responsible and Accountable Large Language Models. arXiv 2024, arXiv:2307.02185.",
15: "Li, W.; Li, J.; Ma, W.; Liu, Y. Citation-Enhanced Generation for LLM-based Chatbots. ACL 2024, pp. 1451-1466.",
16: "Fontana, N.; Corso, F.; Zuccolotto, E.; Pierri, F. Evaluating open-source Large Language Models for automated fact-checking. arXiv 2025, arXiv:2503.05565.",
17: "Kumpulainen, M.; Seppaenen, M. Combining Web of Science and Scopus datasets in citation-based literature study. Scientometrics 2022, 127, 5613-5631.",
18: "Fox, N.B.; Bruyns, B. An Evaluation of Borda Count Variations Using Ranked Choice Voting Data. arXiv 2025, arXiv:2501.00618.",
19: "Wang, W.; Wang, Y.; Huang, H. Ranked Voting based Self-Consistency of Large Language Models. arXiv 2025, arXiv:2505.10772.",
20: "Sana, S.; Brous, D.; Wells, M.T.; Duchin, M. Quantitative Relaxations of Arrow's Axioms. arXiv 2025, arXiv:2506.12961.",
21: "Koloveas, P.; Chatzopoulos, S.; Vergoulis, T.; Tryfonopoulos, C. Can LLMs Predict Citation Intent? An Experimental Analysis of In-Context Learning and Fine-Tuning on Open LLMs. Linking Theory and Practice of Digital Libraries 2025, pp. 207-224.",
22: "Bezerra, D.A.; Silva, F.N.; Amancio, D.R. Leveraging GANs for citation intent classification and its impact on citation network analysis. arXiv 2025, arXiv:2505.21162.",
23: "Shen, J.; Zhou, T.; Chen, Y.; Qiu, D.; Liu, S.; Liu, K.; Zhao, J. Transparentize the Internal and External Knowledge Utilization in LLMs with Trustworthy Citation. ACL Findings 2025, pp. 17858-17877.",
24: "Lahiri, A.; Sanyal, D.K.; Mukherjee, I. CitePrompt: Using Prompts to Identify Citation Intent in Scientific Papers. arXiv 2023, arXiv:2304.12730.",
25: "Smeros, P.; Castillo, C.; Aberer, K. SciLens: Evaluating the Quality of Scientific News Articles Using Social Media and Scientific Literature Indicators. WWW 2019, pp. 1747-1758.",
26: "Cousijn, H.; Kenall, A.; Ganley, E.; Harrison, M.; Kernohan, D.; Murphy, F.; Polischuk, P.; Martone, M.; Clark, T. A Data Citation Roadmap for Scientific Publishers. bioRxiv 2018, 5, 180259.",
27: "Saier, T.; Krause, J.; Faerber, M. unarXive 2022: All arXiv Publications Pre-Processed for NLP, Including Structured Full-Text and Citation Network. arXiv 2023, arXiv:2303.14957.",
28: "Jeong, C.; Jang, S.; Shin, H.; Park, E.; Choi, S. A Context-Aware Citation Recommendation Model with BERT and Graph Convolutional Networks. arXiv 2019, arXiv:1903.06464.",
29: "Jurgens, D.; Kumar, S.; Hoover, R.; McFarland, D.; Jurafsky, D. Measuring the Evolution of a Scientific Field through Citation Frames. Trans. Assoc. Comput. Linguist. 2018, 6, 391-406.",
30: "Tsai, H.J.; Yen, A.Z.; Huang, H.H.; Chen, H.H. Citation Intent Classification and Its Supporting Evidence Extraction for Citation Graph Construction. CIKM 2023, pp. 2472-2481.",
31: "Hu, Z.; Cui, J.; Lin, A. Identifying potentially excellent publications using a citation-based machine learning approach. Inf. Process. Manag. 2023, 60, 103323.",
32: "Medic, Z.; Snajder, J. Improved Local Citation Recommendation Based on Context Enhanced with Global Information. SDP Workshop 2020, pp. 97-103.",
33: "Mifrah, S.; Benlahmar, E.H. Sentence-Level Sentiment Classification A Comparative Study Between Deep Learning Models. J. ICT Stand. 2022, 10, 339-352.",
34: "Kalai, A.T.; Nachum, O.; Vempala, S.S.; Zhang, E. Why Language Models Hallucinate. arXiv 2025, arXiv:2509.04664.",
35: "Mifrah, S.; El Habib, B.L. Semantic Relationship Study between Citing and Cited Scientific Articles Using Topic Modeling. BDIoT 2020.",
36: "Team, G.; Mesnard, T.; Hardin, C.; Dadashi, R.; Bhupatiraju, S.; Pathak, S.; Sifre, L.; Riviere, M.; Kale, M.S.; Love, J.; et al. Gemma: Open Models Based on Gemini Research and Technology. arXiv 2024, arXiv:2403.08295.",
37: "Grattafiori, A.; Dubey, A.; Jauhri, A.; Pandey, A.; Kadian, A.; Al-Dahle, A.; Letman, A.; Mathur, A.; Schelten, A.; Vaughan, A.; et al. The Llama 3 Herd of Models. arXiv 2024, arXiv:2407.21783.",
38: "Jiang, A.Q.; Sablayrolles, A.; Mensch, A.; Bamford, C.; Chaplot, D.S.; Casas, D.; Bressand, F.; Lengyel, G.; Lample, G.; Saulnier, L.; et al. Mistral 7B. arXiv 2023, arXiv:2310.06825.",
39: "Guendoul, O.; Bahaj, A.; Tabii, Y.; Rachid, O.H.T. Preliminary Evaluation of Vision-Language Models for Fall Detection. Springer Nature 2025, pp. 220-234.",
40: "Kilgour, D.M.; Gregoire, J.C.; Foley, A.M. Condorcet efficiency: Weighted Bucklin vs. weighted scoring and Borda. Math. Soc. Sci. 2025, 135, 102420.",
41: "Chen, L.; Zaharia, M.; Zou, J. How is ChatGPT's behavior changing over time? arXiv 2023, arXiv:2307.09009.",
42: "Lu, B.; Sun, Y.; Fan, L.; Ma, X.; Duan, H. Evolutionary characteristics of global offshore carbon emissions network and responsibility allocation of emissions reduction. Patterns 2023, 4, 100801.",
43: "Nadeau, D.; Kroutikov, M.; McNeil, K.; Baribeau, S. Benchmarking Llama2, Mistral, Gemma and GPT for Factuality, Toxicity, Bias and Propensity for Hallucinations. arXiv 2024, arXiv:2404.09785.",
44: "Aydin, O.; Karaarslan, E.; Erenay, F.S.; Bacanin, N. Generative AI in Academic Writing: A Comparison of DeepSeek, Qwen, ChatGPT, Gemini, Llama, Mistral, and Gemma. Turk. J. Eng. 2025, 10, 592-607.",
45: "Mifrah, S. Toward a Semantic Graph of Scientific Publications: A Bibliometric Study. Int. J. Adv. Trends Comput. Sci. Eng. 2020, 9, 3323-3330.",
46: "Mifrah, S.; Ben Lahmar, E.H. Semantico-automatic Evaluation of Scientific Papers: State of the Art. BDCA 2017.",
47: "Lo, K.; Wang, L.L.; Neumann, M.; Kinney, R.; Weld, D. S2ORC: The Semantic Scholar Open Research Corpus. ACL 2020, pp. 4969-4983.",
48: "Hourrane, O.; Mifrah, S.; Benlahmar, E.H.; Bouhriz, N.; Rachdi, M. Using Deep Learning Word Embeddings for Citations Similarity in Academic Papers. Big Data, Cloud and Applications 2018, pp. 185-196.",
49: "Belefqih, S.; Barchane, M.; Zellou, A.; Benlahmar, E.H. A Novel Framework for RDF Schema Extraction in NoSQL Databases Using Sentence-BERT. IEEE Access 2025, 13, 88243-88252.",
50: "Belefqih, S.; Barchane, M.; Zellou, A.; Doumi, K.; Benlahmar, E. Reinforcement Learning for Dynamic RDF Schema Evolution in NoSQL Databases. SITA 2025, pp. 1-6.",
51: "Belefqih, S.; Barchane, M.; Zellou, A.; Benlahmar, E.H. Schema validation and evaluation framework for extracted schemas in JSON databases. Sci. Rep. 2026, 16, 10873.",
52: "Saier, T.; Faerber, M. unarXive: A large scholarly data set with publications' full-text, annotated in-text citations, and links to metadata. Scientometrics 2020, 125, 3085-3108.",
53: "Landis, J.R.; Koch, G.G. The Measurement of Observer Agreement for Categorical Data. Biometrics 1977, 33, 159-174.",
54: "Paolini, L.; Vahdati, S.; Di Iorio, A.; Wardenga, R.; Heibi, I.; Peroni, S. CiteFusion: An ensemble framework for citation intent classification harnessing dual-model binary couples and SHAP analyses. Scientometrics 2025, 130, 5911-5981.",
55: "Wang, H. The Fallacy of Borda Count Method-Why it is Useless with Group Intelligence and Shouldn't be Used with Big Data including Banking Customer Services. SHS Web Conf. 2023, 179, 04008.",
56: "Cousijn, H.; Feeney, P.; Lowenberg, D.; Presani, E.; Simons, N. Bringing Citations and Usage Metrics Together to Make Data Count. Data Sci. J. 2019, 18, 9.",
57: "Shen, J.; Zhou, T.; Chen, Y.; Liu, K.; Zhao, J. CiteLab: Developing and Diagnosing LLM Citation Generation Workflows via the Human-LLM Interaction. ACL 2025 (System Demonstrations), pp. 490-501.",
58: "Zhang, J.; Chen, J.; Maatouk, A.; Bui, N.; Xie, Q.; Tassiulas, L.; Shao, J.; Xu, H.; Ying, R. LitFM: A Retrieval Augmented Structure-aware Foundation Model For Citation Graphs. arXiv 2024, arXiv:2409.12177.",
59: "Zhu, Y.; Zhou, X.; Qiang, J.; Li, Y.; Yuan, Y.; Wu, X. Prompt-Learning for Short Text Classification. arXiv 2022, arXiv:2202.11345.",
60: "Radulescu, C.Z.; Radulescu, M.; Boncea, R. A Hybrid Group Weighting Method based on the Borda and the Group Best Worst Method with application for digital development indicators. Procedia Comput. Sci. 2022, 214, 10-17.",
61: "Cohan, A.; Goharian, N. Scientific document summarization via citation contextualization and scientific discourse. Int. J. Digit. Libr. 2017, 19, 287-303.",
62: "Chen, X.; Li, M.; Gao, S.; Yan, R.; Gao, X.; Zhang, X. Scientific Paper Extractive Summarization Enhanced by Citation Graphs. EMNLP 2022, pp. 4053-4062.",
}

# Each tuple: (section, context_sentence, topic, [ref_ids], classification)
INSTANCES = [
("1. Introduction", "This means they miss the more subtle intellectual influence of a particular article or dataset within scientific discussions [1].", "limits of author/venue-level bibliometric indicators (Impact Factor, h-index)", [1], "background"),
("1. Introduction", "Indeed, this limitation aligns with our previous study [2], where we suggested a hybrid framework that combines citation-based and content-oriented metrics to assess the semantic depth and contextual quality of scientific publications.", "authors' prior hybrid citation/content quality-assessment framework", [2], "background"),
("1. Introduction", "Consequently, with the increasing variety of research communication through journals, evaluation systems need to move from a basic citation-counting approach to a more context-sensitive understanding of scholarly impact [3].", "shift from citation counting to context-sensitive impact assessment", [3], "background"),
("1. Introduction", "Some may indicate endorsement, methodological reuse, theoretical opposition, or simply contextual mention [1,4,5].", "taxonomy of citation functions/intents", [1, 4, 5], "background"),
("1. Introduction", "Accordingly, understanding the function of citations, whether they are background, methodological, comparative, or critical, has become crucial for creating more accurate and semantically rich measures of impact [3,6].", "need for citation-function-aware impact measures", [3, 6], "background"),
("1. Introduction", "The classification of citation intent addresses this challenge by analyzing the textual and rhetorical context around each citation to determine its functional role [7,8].", "definition of citation intent classification task", [7, 8], "background"),
("1. Introduction", "To achieve this, it requires a fine understanding of the immediate linguistic environment of the citing sentence, using methods similar to those in local citation recommendation systems [9].", "linguistic context modeling in local citation recommendation", [9], "comparison"),
("1. Introduction", "Despite significant progress made possible by pretrained Language Models like BERT [10,11] and SciBERT [12], automatic systems still face challenges due to semantic ambiguity and context dependence.", "pretrained language models (BERT/SciBERT) enabling progress", [10, 11], "background"),
("1. Introduction", "Despite significant progress made possible by pretrained Language Models like BERT [10,11] and SciBERT [12], automatic systems still face challenges due to semantic ambiguity and context dependence.", "pretrained language models (BERT/SciBERT) enabling progress", [12], "background"),
("1. Introduction", "As a result, contextualization becomes vital to maintain semantic and argumentative accuracy [13].", "importance of contextualization for citation text fidelity", [13], "background"),
("1. Introduction", "In this regard, it has been argued that citation serves as a foundation of scientific accountability and that the same standard should apply to AI-driven knowledge systems [14].", "citation as a basis for accountability of AI knowledge systems", [14], "background"),
("1. Introduction", "However, LLMs are still prone to semantic hallucinations and interpretive inconsistencies [15,16], problems that are similar to the challenges in citation classification.", "LLM hallucination and interpretive inconsistency", [15, 16], "critique"),
("1. Introduction", "Furthermore, relying on a single model or data source can introduce disciplinary bias, similar to distortions that occur when bibliometric analyses depend only on one citation database like Scopus or Web of Science [17].", "single-database bibliometric bias (Scopus vs. Web of Science)", [17], "comparison"),
("1. Introduction", "Indeed, single-source systems cannot guarantee semantic reliability or epistemic fairness [15,17].", "limits of single-source/single-model systems", [15, 17], "critique"),
("1. Introduction", "Accordingly, in this study, we present a new framework for citation intent classification that combines multiple open LLMs using a weighted Borda voting mechanism [18–20].", "weighted Borda voting mechanism adopted for the framework", [18, 19, 20], "methodology"),
("1. Introduction", "Subsequently, an exponential weighting function boosts the top-ranked predictions, reflecting the consensus in Borda theory that nonlinear rank weighting improves decisiveness [7,8,18].", "nonlinear rank weighting in Borda theory", [7, 8, 18], "methodology"),
("1. Introduction", "As a result, this ensemble approach balances diversity and stability by leveraging different reasoning from multiple models while reducing individual biases and hallucinations [15,17,21–24].", "ensembles reducing model bias and hallucination", [15, 17, 21, 22, 23, 24], "background"),
("1. Introduction", "Ultimately, this work contributes to creating responsible and interpretable scientometric AI, in line with current calls for fair, accountable, and ethically aware Language Models [14,25–27].", "calls for fair, accountable, ethically aware LLMs", [14, 25, 26, 27], "background"),

("2. From Citation Retrieval to Contextual Interpretation", "Citation recommendation systems constitute a foundational component of computational citation analysis, as they aim to identify the most relevant references for a specific textual passage rather than for an entire document [8].", "definition/scope of citation recommendation systems", [8], "background"),
("2. From Citation Retrieval to Contextual Interpretation", "In this sense, these systems view citation as a reasoning process that uses linguistic and structural cues to identify which prior work best supports a statement [28,29].", "citation as a linguistic/structural reasoning process", [28, 29], "background"),
("2. From Citation Retrieval to Contextual Interpretation", "It categorizes each reference based on its rhetorical and cognitive function, whether to provide background, describe a methodological contribution, or support a comparative discussion [4,30].", "rhetorical/cognitive citation function taxonomy", [4, 30], "background"),
("2. From Citation Retrieval to Contextual Interpretation", "As highlighted in [2,31], analyzing citations in context is a vital step toward evaluating the interpretive aspects of scientific communication.", "value of in-context citation analysis", [2, 31], "background"),
("2. From Citation Retrieval to Contextual Interpretation", "Models like BERT and SciBERT can capture bidirectional semantic relationships in citation contexts, allowing for better classification of rhetorical intentions [10,12,32,33].", "BERT/SciBERT for citation context classification", [10, 12, 32, 33], "background"),
("2. From Citation Retrieval to Contextual Interpretation", "Moreover, semi-supervised architectures like cGAN-SciBERT show that using unlabeled data can greatly improve model generalization and reduce reliance on expensive manual annotation [22].", "semi-supervised cGAN-SciBERT using unlabeled data", [22], "comparison"),
("2. From Citation Retrieval to Contextual Interpretation", "While their generative abilities enhance reasoning across long text spans, their absence of clear citation mechanisms raises significant questions about transparency, reproducibility, and intellectual accountability [22,34].", "lack of transparent citation mechanisms in generative LLMs", [22, 34], "critique"),
("2. From Citation Retrieval to Contextual Interpretation", "Both areas aim to model the relationships between scientific texts: one finds relevant references, while the other explains their roles in discourse [35].", "overlap between citation recommendation and intent classification", [35], "background"),

("3. Proposed Methodological Approach", "Architectural heterogeneity arises from differences in training corpora, filtering pipelines, tokenization schemes, and fine-tuning strategies developed by Google [36], Meta [37], and Mistral AI [38].", "source/origin of the Gemma model used in the ensemble", [36], "usage"),
("3. Proposed Methodological Approach", "Architectural heterogeneity arises from differences in training corpora, filtering pipelines, tokenization schemes, and fine-tuning strategies developed by Google [36], Meta [37], and Mistral AI [38].", "source/origin of the LLaMA model used in the ensemble", [37], "usage"),
("3. Proposed Methodological Approach", "Architectural heterogeneity arises from differences in training corpora, filtering pipelines, tokenization schemes, and fine-tuning strategies developed by Google [36], Meta [37], and Mistral AI [38].", "source/origin of the Mistral model used in the ensemble", [38], "usage"),
("3. Proposed Methodological Approach", "Such independence strengthens complementary semantic coverage and improves robustness across instruction-following tasks, including multimodal settings such as vision-language applications [39].", "robustness of independent LLMs in multimodal/vision-language tasks", [39], "background"),
("3. Proposed Methodological Approach", "Each model assigns one label among five citation intent categories: background, methodology, comparison, extension, and critique, aligned with established citation analysis taxonomies in scientific discourse [30].", "five-category citation-intent taxonomy adopted in this study", [30], "usage"),
("3. Proposed Methodological Approach", "The aggregation layer merges these rankings through an exponential Borda scheme derived from nonlinear weighting principles [18], which concentrates influence on top-ranked predictions and reinforces inter-model agreement.", "nonlinear weighting principles underlying the exponential Borda scheme", [18], "methodology"),
("3. Proposed Methodological Approach", "This design maintains explicit score attribution and supports interpretability through alignment with explainable AI methods such as SHAP and LIME [30].", "alignment with explainable-AI methods (SHAP, LIME)", [30], "comparison"),
("3. Proposed Methodological Approach", "It also preserves the classical two-stage Borda structure formalized by Garcia-Lapresta, Martinez-Panero, and Meneses [40], while extending the interpretability-oriented fusion framework introduced in [2], which integrates quantitative signals with contextual evidence in scientometric analysis.", "classical two-stage Borda structure directly reused", [40], "usage"),
("3. Proposed Methodological Approach", "It also preserves the classical two-stage Borda structure formalized by Garcia-Lapresta, Martinez-Panero, and Meneses [40], while extending the interpretability-oriented fusion framework introduced in [2], which integrates quantitative signals with contextual evidence in scientometric analysis.", "authors' prior interpretability-oriented fusion framework, extended here", [2], "extension"),
("3. Model Selection Criteria and Reproducible Deployment", "Their independent development reduces shared biases and improves methodological stability compared to proprietary systems, where undocumented updates and behavioral drift can compromise experimental consistency [41].", "behavioral drift/instability of proprietary LLMs (ChatGPT)", [41], "comparison"),
("3. Model Selection Criteria and Reproducible Deployment", "It also strengthens reproducibility by ensuring consistent model behavior over time and across computational environments [42].", "reproducibility of model behavior across environments", [42], "background"),
("3. Model Selection Criteria and Reproducible Deployment", "Nadeau et al. [43] tested Llama2, Mistral, and Gemma on factuality, toxicity, bias, and hallucination. Their results show distinct capability profiles for these architectures.", "benchmark of Llama2/Mistral/Gemma on factuality, toxicity, bias, hallucination", [43], "comparison"),
("3. Model Selection Criteria and Reproducible Deployment", "In terms of classification performance, Gemma-3-12B-it has been found to outperform Llama-3.1-8B-Instruct in in-context learning settings [44].", "Gemma outperforming LLaMA in in-context learning", [44], "comparison"),
("3. Model Selection Criteria and Reproducible Deployment", "Additionally, Mistral 7B performs better than LLaMA 2 13B across all evaluated benchmarks [38].", "Mistral 7B outperforming LLaMA 2 13B on benchmarks", [38], "comparison"),

("4. Data Collection and Preparation", "The empirical foundation of this study relies on a large-scale, high-quality corpus that enables both linguistic and scientometric analyses of citation behavior [45].", "need for a large-scale corpus for citation behavior analysis", [45], "background"),
("4. Data Collection and Preparation", "Existing datasets such as CiteSeerX and ACL Anthology remain limited by their restricted disciplinary coverage and incomplete linkage between textual and bibliographic information [8,46].", "limitations of CiteSeerX/ACL Anthology datasets", [8, 46], "critique"),
("4. Data Collection and Preparation", "Similarly, the absence of unified metadata structures has long constrained the reproducibility and comparability of contextual citation models [7,28].", "lack of unified metadata limiting reproducibility of citation models", [7, 28], "critique"),
("4. Data Collection and Preparation", "This design is consistent with the methodological principles established in [2], where the integration of textual content and bibliometric data was identified as a prerequisite for reliable scientometric modeling.", "prior work's principle of integrating text and bibliometric data", [2], "background"),
("4. Data Collection and Preparation", "To address this requirement, we adopted the unarXive 2022 dataset, introduced by [27], as the principal source for corpus construction.", "unarXive 2022 dataset directly used as the study's corpus", [27], "usage"),
("4. Data Collection and Preparation", "Such an architecture aligns with the objectives of corpora such as S2ORC [47] and SciLens [25], while offering stronger disciplinary breadth and greater citation-network completeness.", "comparison with S2ORC corpus design", [47], "comparison"),
("4. Data Collection and Preparation", "Such an architecture aligns with the objectives of corpora such as S2ORC [47] and SciLens [25], while offering stronger disciplinary breadth and greater citation-network completeness.", "comparison with SciLens corpus design", [25], "comparison"),
("4. Data Collection and Preparation", "This adaptive strategy produces coherent citation contexts while remaining robust to the fragmented sentence structures frequently encountered in scientific documents containing LaTeX equations and formatting artifacts, thereby providing informative inputs for downstream citation intent classification [48].", "informative citation-context inputs for downstream classification", [48], "background"),
("4. Data Collection and Preparation", "This preprocessing step generates informative inputs for the subsequent citation intent classification model and approximates the citation contexts used in benchmark datasets such as SciCite [4].", "comparison with SciCite benchmark citation-context format", [4], "comparison"),

("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "This ensemble ensures interpretability and robustness by combining exponential ranking sensitivity with a deterministic tie-breaking strategy based on empirically informed model priorities [2,18,44].", "basis for the deterministic tie-breaking / model priority design", [2, 18, 44], "methodology"),
("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "The system applies an exponential weighting function, wk = e^gamma(n-k), to amplify the influence of top-ranked predictions while gradually reducing the contribution of lower-ranked ones [7,8].", "rationale for amplifying top-ranked predictions in weighting function", [7, 8], "methodology"),
("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "Aggregated scores across models produce a global relevance value S(c) for each label [15,21].", "aggregated relevance scoring across models", [15, 21], "background"),
("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "the ensemble uses a fixed model-priority hierarchy (Gemma > LLaMA > Mistral), complemented by the average rank R(c) and the first-rank frequency F(c) [14,44].", "combining quantitative evidence with model reliability priority", [14, 44], "background"),
("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "This multi-layered mechanism ensures that the final label ŷ(x) reflects both the quantitative evidence and the qualitative reliability of the contributing models [20,25].", "quantitative vs. qualitative reliability of contributing models", [20, 25], "background"),
("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "The ensemble also outputs a normalized confidence score Conf(x), providing a clear measure of certainty [3,50,51].", "confidence/certainty scoring in classification systems", [3, 50, 51], "background"),
("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "this formulation is consistent with recent advances in semantic representation and structured knowledge extraction, where contextual embedding methods have been shown to improve semantic coherence and interoperability in complex data environments [49].", "contextual embeddings improving semantic coherence (authors' own prior work)", [49], "comparison"),
("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "Figure 5 presents the overall workflow of the exponentially weighted Borda ensemble [7,18], while Figure 6 illustrates the exponential weighting curve [2,11].", "workflow diagram basis for the Borda ensemble", [7, 18], "background"),
("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "Figure 5 presents the overall workflow of the exponentially weighted Borda ensemble [7,18], while Figure 6 illustrates the exponential weighting curve [2,11].", "basis for the exponential weighting curve figure", [2, 11], "background"),
("5. Analytical Formulation of the Exponentially Weighted Borda Ensemble", "This design mirrors human decision-making, stabilizes inter-model voting, and makes each ranked position's contribution explicit and traceable [10,22].", "explicit/traceable contribution of ranked positions", [10, 22], "background"),

("6. Reconciling the Data Skew", "This imbalance, consistent with previously collected data statistics on large-scale corpora [27,52], is problematic for standard classifiers, which are inherently biased towards majority classes, and often yield poor results on minority classes like critique.", "class imbalance consistent with unarXive corpus statistics", [27, 52], "comparison"),

("7. Empirical Evaluation", "According to Landis and Koch's interpretation of kappa values [53], values greater than 0.80 indicate almost perfect agreement.", "Landis & Koch kappa interpretation scale used to assess agreement", [53], "usage"),
("7. Empirical Evaluation", "Moreover, this observation aligns with prior work demonstrating that domain-specific pretraining improves contextual understanding and lexical discrimination in scientific texts [1].", "domain-specific pretraining improving scientific-text understanding", [1], "comparison"),
("7. Empirical Evaluation", "In addition, variance analysis across five random seeds showed minimal fluctuations, confirming that ensemble-generated labels enhance both robustness and reproducibility [6].", "robustness/reproducibility of ensemble-generated labels vs. prior work", [6], "comparison"),
("7. Empirical Evaluation", "Finally, the experimental outcomes extend the conceptual framework proposed in [2] by shifting citation evaluation from purely metric-based approaches toward a discourse-aware classification paradigm.", "authors' prior conceptual framework, extended by this study's results", [2], "extension"),

("8. Discussion", "The observed stability of precision and recall across categories confirms that the fusion pipeline produces linguistically meaningful labels while preserving clear weight attribution in line with explainable AI principles [3,30,54].", "alignment with explainable-AI principles for citation classification", [3, 30, 54], "background"),
("8. Discussion", "However, residual confusion between comparison and critique reflects mixed rhetorical cues documented in prior studies, highlighting the need for future work on multi-label or hierarchical intent taxonomies [1].", "known confusion between comparison/critique rhetorical cues", [1], "comparison"),
("8. Discussion", "Table 6 situates our SciBERT classifier within the evolution from early feature-driven baselines to domain-specialized and semi-supervised Transformer architectures [1,4,12,29].", "benchmark comparison table against prior citation-intent classifiers", [1, 4, 12, 29], "comparison"),
("8. Discussion", "our approach attains a macro-F1 of 83%, surpassing classical systems such as Jurgens et al. (53% on ACL-ARC) and fine-tuned SciBERT on the same benchmark (70.98%), despite operating on a more fine-grained five-class taxonomy.", "performance comparison vs. Jurgens et al. (ACL-ARC) and SciBERT", [29, 12], "comparison"),
("8. Discussion", "Although SciCite models reach 84-85% F1 on a simpler three-class setup, our results demonstrate that comparable performance is achievable on a substantially more complex intent distinction [1,4,12,29].", "performance comparison vs. SciCite three-class models", [1, 4, 12, 29], "comparison"),
("8. Discussion", "The deterministic exponential Borda weighting aggregates heterogeneous LLM preferences into a balanced training corpus, thereby prioritizing the most reliable cross-model signals [18].", "Borda weighting method underlying the aggregation approach", [18], "methodology"),
("8. Discussion", "In this context, stable performance on background and critique underscores the benefits of domain-specific pretraining for scholarly discourse [1,12].", "benefit of domain-specific pretraining (SciBERT) for scholarly text", [1, 12], "comparison"),
("8. Discussion", "In summary, training SciBERT on the Borda-Fusion dataset achieves a macro-F1 of 83%, reaching strong semi-supervised benchmarks without relying on adversarial or generative strategies [6], as illustrated in Figure 10.", "comparison with semi-supervised/adversarial (GAN-based) benchmarks", [6], "comparison"),

("9. Conclusions", "By providing a mathematically grounded mechanism for aggregating heterogeneous model preferences, the exponential Borda weighting extends traditional decision-making principles to multi-model reasoning [18,55].", "traditional Borda/decision-making principles extended to multi-model reasoning", [18, 55], "extension"),
("9. Conclusions", "This formulation enables the proposed framework to produce intent-aware citation classifications that move beyond citation counts toward a richer interpretation of scientific influence [22].", "moving beyond citation counts toward intent-aware influence measures", [22], "background"),
("9. Conclusions", "Furthermore, the framework aligns with the principles of transparency, reproducibility, and interoperability advocated by open science initiatives, ensuring that each classification remains traceable to verifiable textual evidence [17,56].", "open-science principles of transparency and reproducibility", [17, 56], "background"),
("9. Conclusions", "The proposed framework is applicable to several research scenarios, including intent-aware bibliometric analysis, scientific recommendation systems, digital libraries, and systematic literature reviews, where distinguishing citation functions can provide a more informative assessment of scientific influence than citation counts alone [22,25].", "application scenarios: bibliometrics, recommendation, digital libraries, reviews", [22, 25], "background"),
("9. Conclusions", "Integrating explicit citation insertion strategies, including pre hoc and post hoc contextual citation generation, could transform the framework into an explainable citation recommendation system [14,57–59].", "future work: citation insertion / explainable citation recommendation", [14, 57, 58, 59], "background"),
("9. Conclusions", "Likewise, incorporating a human-in-the-loop component would improve reliability for ambiguous citation contexts [8].", "future work: human-in-the-loop for ambiguous citations", [8], "background"),
("9. Conclusions", "Finally, extending the hybrid architecture with graph-based influence models and adaptive ensemble weighting strategies could further enhance both classification performance and interpretability [60–62].", "future work: graph-based influence models and adaptive ensemble weighting", [60, 61, 62], "background"),
("9. Conclusions", "Overall, this work positions citation intent classification as an important building block for transparent, explainable, and ethically aligned AI systems supporting scientific knowledge discovery and scholarly communication [14,52].", "citation intent classification as a building block for ethical AI systems", [14, 52], "background"),
]

CLASS_DEFINITIONS = {
    "background": "General context, motivation, or prior knowledge; the cited work supports a claim without being directly reused, compared, or challenged.",
    "methodology": "The cited work's method, theory, or formalism is directly adapted or built upon in the paper's own approach.",
    "usage": "A specific artifact from the cited work (dataset, model, tool, scale, taxonomy) is directly employed in the study.",
    "comparison": "The cited work (or its results) is contrasted or benchmarked against another approach, dataset, or against the paper's own results.",
    "extension": "The paper explicitly extends, builds upon, or generalizes a framework/idea introduced in the cited work (often the authors' own prior work).",
    "critique": "The cited work or the phenomenon it documents is identified as having a limitation, weakness, or problem that motivates the current study.",
}


def expand_citation_number(cid: int) -> str:
    return f"[{cid}]"


def build_rows():
    rows = []
    counter = 1
    for section, context, topic, refs, cls in INSTANCES:
        marker = "[" + ",".join(str(r) for r in refs) + "]"
        for ref in refs:
            rows.append({
                "paper_id": PAPER_ID,
                "citation_id": f"{PAPER_ID}-C{counter:03d}",
                "section": section,
                "in_text_marker": marker,
                "cited_ref_number": ref,
                "cited_reference": REFERENCES[ref],
                "classification": cls,
                "citation_context": context,
                "citation_topic": topic,
            })
            counter += 1
    return rows


def main():
    rows = build_rows()

    csv_path = "citation_intent_dataset.csv"
    fieldnames = ["paper_id", "citation_id", "section", "in_text_marker",
                  "cited_ref_number", "cited_reference", "classification",
                  "citation_context", "citation_topic"]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    json_path = "citation_intent_dataset.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "paper": {
                "id": PAPER_ID,
                "doi": PAPER_DOI,
                "title": "Citation Intent Classification via Exponential Borda Fusion and SciBERT",
                "authors": ["Mohammed Barchane", "Saad Belefqih", "El Habib Ben Lahmar", "Omar Zahour", "Ahmed Zellou"],
                "venue": "Algorithms 2026, 19, 612",
            },
            "classification_scheme": CLASS_DEFINITIONS,
            "citations": rows,
        }, f, ensure_ascii=False, indent=2)

    from collections import Counter
    dist = Counter(r["classification"] for r in rows)
    print(f"Total citation instances (rows): {len(rows)}")
    print(f"Distinct in-text citation groups: {len(INSTANCES)}")
    print("Class distribution:")
    for k, v in sorted(dist.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
