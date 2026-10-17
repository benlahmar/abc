package com.universite.esign.batch;

import java.util.List;

import com.universite.esign.apogee.ApogeeAssembler.Assembled;

/** Résultat d'une vérification sans signature : ce qui serait produit et les erreurs à corriger. */
public record DryRunReport(int rows, int documents, int valid, int invalid, List<Problem> problems,
                           /** Aperçu des documents valides (500 au plus), pour contrôle avant signature. */
                           List<Preview> preview) {

    static final int PREVIEW_LIMIT = 500;

    public record Problem(String key, String lines, List<String> errors) {
    }

    public record Preview(String key, String cne, String student, String filiere, String niveau, String semester,
                          int modules, String lines) {
    }

    static DryRunReport of(int rows, List<Assembled> documents) {
        List<Problem> problems = documents.stream().filter(a -> !a.valid())
                .map(a -> new Problem(a.key(), a.lines(), a.errors())).toList();
        List<Preview> preview = documents.stream().filter(Assembled::valid).limit(PREVIEW_LIMIT).map(a -> {
            var r = a.request();
            return new Preview(a.key(), a.cne(), r.student().prenom() + " " + r.student().nom(), r.student().filiere(),
                    r.student().niveau(), r.semester(), r.gradesOrEmpty().size(), a.lines());
        }).toList();
        return new DryRunReport(rows, documents.size(), documents.size() - problems.size(), problems.size(), problems,
                preview);
    }
}
