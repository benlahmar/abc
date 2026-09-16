#!/usr/bin/env python3
"""Re-split the deduplicated SciCite-derived dataset by citing paper, so that
all citations from the same citing paper land in the same split. This fixes
the cross-split leakage documented in the audit (a citing paper's rows were
previously scattered across train/dev/test).

Adds a new column `split_resplit_by_paper` (keeping the original `split`
column untouched for reference/comparison) and verifies zero leakage.
"""
import csv
import collections
import hashlib

IN_PATH = "scicite_fine_classified_full.csv"
OUT_PATH = "scicite_fine_classified_full.csv"  # overwrite in place, adding a column

# Match the original corpus-wide proportions (train/dev/test ~= 74.8/8.3/16.9)
TRAIN_CUTOFF = 0.748
DEV_CUTOFF = 0.748 + 0.083


def assign_split(paper_id: str) -> str:
    """Deterministic pseudo-random assignment based on a hash of paper_id,
    so re-running the script is fully reproducible without storing state."""
    h = hashlib.sha256(paper_id.encode("utf-8")).hexdigest()
    frac = int(h[:8], 16) / 0xFFFFFFFF
    if frac < TRAIN_CUTOFF:
        return "train"
    elif frac < DEV_CUTOFF:
        return "dev"
    return "test"


def main():
    rows = list(csv.DictReader(open(IN_PATH, encoding="utf-8")))
    paper_split = {}
    for r in rows:
        pid = r["paper_id"]
        if pid not in paper_split:
            paper_split[pid] = assign_split(pid)
        r["split_resplit_by_paper"] = paper_split[pid]

    # Verify zero leakage by construction
    check = collections.defaultdict(set)
    for r in rows:
        check[r["paper_id"]].add(r["split_resplit_by_paper"])
    leaks = [pid for pid, splits in check.items() if len(splits) > 1]
    print(f"Papers with leakage after re-split: {len(leaks)} (must be 0)")

    dist = collections.Counter(r["split_resplit_by_paper"] for r in rows)
    total = len(rows)
    print("New split row distribution:")
    for k, v in dist.items():
        print(f"  {k}: {v} ({100*v/total:.1f}%)")

    label_by_split = collections.defaultdict(collections.Counter)
    for r in rows:
        label_by_split[r["split_resplit_by_paper"]][r["classification"]] += 1
    print("\nClass distribution per new split (checking no severe skew):")
    for split in ["train", "dev", "test"]:
        c = label_by_split[split]
        tot = sum(c.values())
        print(f"  {split}: " + ", ".join(f"{k}={100*v/tot:.1f}%" for k, v in c.most_common()))

    fieldnames = list(rows[0].keys())
    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"\nWrote {len(rows)} rows with new column 'split_resplit_by_paper' to {OUT_PATH}")


if __name__ == "__main__":
    main()
