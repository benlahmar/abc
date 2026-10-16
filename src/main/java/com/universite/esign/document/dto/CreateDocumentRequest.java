package com.universite.esign.document.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import com.universite.esign.document.DocumentType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateDocumentRequest(
        @NotNull DocumentType type,
        @NotNull @Valid StudentInfo student,
        @NotBlank @Pattern(regexp = "\\d{4}-\\d{4}", message = "format attendu : 2025-2026") String academicYear,
        /** Semestre (S1…S10), obligatoire pour un relevé de notes. */
        @Size(max = 10) String semester,
        /** Notes des modules, obligatoires pour un relevé de notes. */
        @Size(max = 60) List<@Valid @NotNull GradeLine> grades,
        /** Agent qui établit le document, obligatoire quand une application appelle avec son propre jeton. */
        @Valid IssuedBy issuedBy,
        /** Usage du document (ex. ETRANGER, INSCRIPTION), peut déclencher une étape du circuit. */
        @Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}", message = "majuscules, chiffres et _ uniquement") String purpose,
        /** Demande une validation supplémentaire (active les étapes IF_ESCALATED du circuit). */
        Boolean escalate) {

    public boolean escalated() {
        return Boolean.TRUE.equals(escalate);
    }

    public List<GradeLine> gradesOrEmpty() {
        return grades == null ? List.of() : grades;
    }

    /** Moyenne pondérée par les crédits, arrondie au centième. */
    public BigDecimal average() {
        List<GradeLine> lines = gradesOrEmpty();
        if (lines.isEmpty()) {
            return null;
        }
        BigDecimal total = BigDecimal.ZERO;
        int weights = 0;
        for (GradeLine line : lines) {
            total = total.add(line.note().multiply(BigDecimal.valueOf(line.weight())));
            weights += line.weight();
        }
        return total.divide(BigDecimal.valueOf(weights), 2, RoundingMode.HALF_UP);
    }
}
