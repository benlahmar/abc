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
    r"|\b(?:based on|built (?:up)?on) (?:the )?(?:method|approach|algorithm|tool|dataset|framework|model|technique)\b",
    re.IGNORECASE,
)

CRITIQUE_RE = re.compile(
    r"\bhowever\b|\bin contrast\b|\bunlike\b|\bfail(?:s|ed)?\b|\bcannot\b|\bdoes not\b|\bdid not\b"
    r"|\blimitation|\binconsistent|\bcontradict|\boverestimat|\bunderestimat|\bweakness"
    r"|\bno significant\b|\bnot support|\bdisagree|\bdespite\b",
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


def main():
    rows = load_all()
    out_rows = []
    for r in rows:
        fine, rule = classify_fine(r["label"], r.get("label2"), r["string"])
        out_rows.append({
            "dataset_source": "scicite",
            "split": r["split"],
            "paper_id": r["citingPaperId"],
            "citation_id": r["unique_id"],
            "section": normalize_section(r.get("sectionName", "")),
            "citation_context": r["string"],
            "citation_topic": "",  # not auto-generated at this stage; see README
            "cited_reference": r["citedPaperId"],
            "label_coarse": r["label"],
            "label2_scicite": r.get("label2") or "",
            "classification": fine,
            "classification_rule": rule,
            "classification_method": "heuristic_rule_based",
            "is_key_citation": r.get("isKeyCitation"),
            "source_marker_type": r.get("source"),
        })

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
