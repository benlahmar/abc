package com.universite.esign.batch;

import java.util.List;

import com.universite.esign.apogee.ApogeeAssembler.Assembled;

/** Résultat d'une vérification sans signature : ce qui serait produit et les erreurs à corriger. */
public record DryRunReport(int rows, int documents, int valid, int invalid, List<Problem> problems) {

    public record Problem(String key, String lines, List<String> errors) {
    }

    static DryRunReport of(int rows, List<Assembled> documents) {
        List<Problem> problems = documents.stream().filter(a -> !a.valid())
                .map(a -> new Problem(a.key(), a.lines(), a.errors())).toList();
        return new DryRunReport(rows, documents.size(), documents.size() - problems.size(), problems.size(), problems);
    }
}
