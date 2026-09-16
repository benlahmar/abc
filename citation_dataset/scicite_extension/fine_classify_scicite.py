#!/usr/bin/env python3
"""Rule-based fine-grained re-classification of SciCite (background/method/result)
into a 6-class scheme aligned with citation_dataset/citation_intent_dataset.csv:
background, methodology, usage, comparison, extension, critique.

This is a transparent, auditable heuristic pass (regex cues + the SciCite
`label2` weak signal), NOT a trained/LLM classifier. It is meant as a fast
pilot to bootstrap the fine taxonomy over the full 11,020 SciCite rows, to be
spot-checked and refined afterwards.
"""
import json
import re
import csv
import collections
import random

USAGE_RE = re.compile(
    r"\bwe (use|used|utili[sz]e[sd]?|employ(?:ed|s)?|adopt(?:ed|s)?|appl(?:y|ied)|implement(?:ed|s)?)\b"
    r"|\busing (?:the |a |an )?(?:method|approach|algorithm|tool|toolkit|dataset|corpus|framework|model|package|library|code|software|technique|pipeline)\b"
    r"|\b(?:based on|built (?:up)?on) (?:the )?(?:method|approach|algorithm|tool|dataset|framework|model|technique)\b"
    # Added after an LLM-assisted verification pass (330-row pilot, Sept 2026):
    # passive-voice usage of a named artifact/protocol is the single biggest
    # source of missed `usage` cases in the original heuristic (~68% of
    # methodology-default rows in the verified sample were actually usage).
    r"|\b(?:assessed|measured|evaluated|calculated|analyz(?:ed)?|analys(?:ed)?|performed|prepared|carried out"
    r"|conducted|determined|quantified|obtained|purified|extracted|sequenced|identified|detected|collected)\b"
    r".{0,40}\b(?:using|with|via)\b"
    r"|\bas (?:previously |elsewhere )?described\b",
    re.IGNORECASE,
)

CRITIQUE_RE = re.compile(
    r"\bhowever\b|\bin contrast\b|\bunlike\b|\bfail(?:s|ed)?\b|\bcannot\b|\bdoes not\b|\bdid not\b"
    r"|\blimitation|\binconsistent|\bcontradict|\boverestimat|\bunderestimat|\bweakness"
    r"|\bno significant\b|\bnot support|\bdisagree|\bdespite\b"
    # Added after a targeted LLM-assisted hunt for critique/extension hidden in
    # the "comparison" default bucket (300-row sample, 7/8 precision on these
    # additions, i.e. 87.5%):
    r"|\bcontrary to\b|\bconflicting\b|\bnot consistent with\b|\bopposite (?:trend|effect|results?)\b",
    re.IGNORECASE,
)

EXTENSION_RE = re.compile(
    r"\bextend(?:s|ed)?\b|\bbuild(?:s)? (?:up)?on\b|\bbuilding (?:up)?on\b"
    r"|\bfurther (?:improv|develop|extend)|\bgeneraliz|\bexpand(?:s|ed)? (?:up)?on\b",
    re.IGNORECASE,
)

COMPARISON_RE = re.compile(
    r"\bcompar(?:e|ed|ison)\b|\bconsistent with\b|\bsimilar(?:ly)? to\b|\bin agreement with\b"
    r"|\bsame as\b|\balso (?:found|report(?:ed)?|observ(?:e|ed))\b|\boutperform|\bbetter than\b|\bworse than\b",
    re.IGNORECASE,
)


def classify_fine(label, label2, text):
    if label == "background":
        return "background", "kept_as_is"
    if label == "method":
        if USAGE_RE.search(text):
            return "usage", "usage_cue_matched"
        return "methodology", "default_method"
    if label == "result":
        # NOTE: label2 == "not_supportive" was tested as a critique signal during
        # the pilot spot-check and produced clear false positives (e.g. sentences
        # containing "in agreement with" / "consistent with" were flagged as
        # not_supportive by SciCite's own annotation yet are supportive
        # comparisons in plain reading). It is therefore NOT used for critique.
        if CRITIQUE_RE.search(text):
            return "critique", "critique_cue_matched"
        if EXTENSION_RE.search(text):
            return "extension", "extension_cue_matched"
        if COMPARISON_RE.search(text) or label2 == "supportive":
            return "comparison", "comparison_cue_or_label2"
        return "comparison", "default_result"
    return "unknown", "unmapped_label"


def normalize_section(name):
    if not name or not isinstance(name, str):
        return "Unknown"
    n = name.strip()
    n = re.sub(r"^[\dIVX]+[.\)]\s*", "", n)  # strip leading numbering like "4." or "IV."
    return n.strip().title() if n else "Unknown"


def load_all():
    rows = []
    for split in ["train", "dev", "test"]:
        with open(f"/tmp/scicite_data/scicite/{split}.jsonl") as f:
            for line in f:
                d = json.loads(line)
                d["split"] = split
                rows.append(d)
    return rows


def load_llm_verified_overrides():
    """Load the 328 rows verified by an LLM-assisted pass (3 parallel agents,
    110 rows each, targeting the weakest-recall heuristic buckets). These
    override the heuristic label and are marked with a distinct
    classification_method so downstream users can filter by confidence tier.
    """
    overrides = {}
    for i in [1, 2, 3]:
        path = f"llm_pass_chunk_{i}_labeled.csv"
        try:
            with open(path) as f:
                for r in csv.DictReader(f):
                    overrides[r["citation_id"]] = r["new_classification"]
        except FileNotFoundError:
            pass
    # Second LLM-assisted pass: targeted hunt for critique/extension hidden
    # in the "comparison" default bucket (300-row stratified sample).
    for i in [1, 2, 3]:
        path = f"ce_hunt_chunk_{i}_labeled.csv"
        try:
            with open(path) as f:
                for r in csv.DictReader(f):
                    overrides[r["citation_id"]] = r["new_classification"]
        except FileNotFoundError:
            pass
    return overrides


def main():
    rows = load_all()
    overrides = load_llm_verified_overrides()
    out_rows = []
    for r in rows:
        fine, rule = classify_fine(r["label"], r.get("label2"), r["string"])
        cid = r["unique_id"]
        method = "heuristic_rule_based"
        if cid in overrides:
            fine = overrides[cid]
            rule = "llm_verified_override"
            method = "llm_assisted_verified"
        out_rows.append({
            "dataset_source": "scicite",
            "split": r["split"],
            "paper_id": r["citingPaperId"],
            "citation_id": cid,
            "section": normalize_section(r.get("sectionName", "")),
            "citation_context": r["string"],
            "citation_topic": "",  # not auto-generated at this stage; see README
            "cited_reference": r["citedPaperId"],
            "label_coarse": r["label"],
            "label2_scicite": r.get("label2") or "",
            "classification": fine,
            "classification_rule": rule,
            "classification_method": method,
            "is_key_citation": r.get("isKeyCitation"),
            "source_marker_type": r.get("source"),
        })

    n_verified = sum(1 for r in out_rows if r["classification_method"] == "llm_assisted_verified")
    print(f"Applied {n_verified} LLM-verified overrides on top of the heuristic pass.\n")

    # De-duplicate citation_id groups. The raw SciCite corpus contains 60
    # duplicate citation_id values: 51 are the *same* sentence duplicated
    # (50 of those only differ by a mojibake re-encoding artifact, e.g.
    # "Griffith's" vs "Griffith‚Äôs"), and 9 are genuine cross-split
    # duplicates (identical or near-identical citation appearing in two of
    # train/dev/test). Within each group we keep the row without the
    # mojibake marker when one exists, else the first encountered
    # (train > dev > test, per load_all's iteration order).
    MOJIBAKE_MARKER = "‚Ä"  # the "‚Ä" sequence seen in corrupted rows
    by_id = collections.defaultdict(list)
    for r in out_rows:
        by_id[r["citation_id"]].append(r)
    deduped_rows = []
    n_dropped = 0
    for cid, group in by_id.items():
        if len(group) == 1:
            deduped_rows.append(group[0])
            continue
        n_dropped += len(group) - 1
        clean = [g for g in group if MOJIBAKE_MARKER not in g["citation_context"]]
        deduped_rows.append(clean[0] if clean else group[0])
    print(f"De-duplication: dropped {n_dropped} duplicate citation_id rows "
          f"({len(out_rows)} -> {len(deduped_rows)}).\n")
    out_rows = deduped_rows

    dist = collections.Counter(r["classification"] for r in out_rows)
    rule_dist = collections.Counter(r["classification_rule"] for r in out_rows)
    print("Fine classification distribution (full 11,020 rows):")
    for k, v in dist.most_common():
        print(f"  {k}: {v} ({100*v/len(out_rows):.1f}%)")
    print("\nRule trigger distribution:")
    for k, v in rule_dist.most_common():
        print(f"  {k}: {v}")

    fieldnames = list(out_rows[0].keys())
    with open("scicite_fine_classified_full.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(out_rows)

    # Stratified pilot sample for manual spot-check: ~60 per fine class (or all if fewer)
    random.seed(42)
    by_class = collections.defaultdict(list)
    for r in out_rows:
        by_class[r["classification"]].append(r)
    pilot = []
    for cls, items in by_class.items():
        random.shuffle(items)
        pilot.extend(items[:60])
    random.shuffle(pilot)
    print(f"\nPilot sample size (for manual spot-check): {len(pilot)}")

    with open("scicite_pilot_sample.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(pilot)


if __name__ == "__main__":
    main()
