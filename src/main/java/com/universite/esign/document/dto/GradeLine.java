package com.universite.esign.document.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record GradeLine(
        @NotBlank @Size(max = 20) String code,
        @NotBlank @Size(max = 150) String intitule,
        @NotNull @DecimalMin("0") @DecimalMax("20") @Digits(integer = 2, fraction = 2) BigDecimal note,
        /** Crédits ECTS ou coefficient du module (1 par défaut). */
        @Positive Integer credits,
        /** Résultat du module (V, NV, VAR…). Déduit de la note si absent. */
        @Size(max = 10) String resultat) {

    public int weight() {
        return credits == null ? 1 : credits;
    }

    public String effectiveResult() {
        if (resultat != null && !resultat.isBlank()) {
            return resultat;
        }
        return note.compareTo(BigDecimal.TEN) >= 0 ? "V" : "NV";
    }
}
