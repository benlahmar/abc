package com.universite.esign.workflow.dto;

import java.util.List;

import com.universite.esign.workflow.ConditionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record WorkflowStepDto(
        /** Libellé affiché, ex. « Validation du vice-doyen à la pédagogie ». */
        @NotBlank @Size(max = 100) String name,
        /** Rôle Keycloak du realm autorisé à décider, ex. VICE_DOYEN_PEDAGOGIE. */
        @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,59}", message = "majuscules, chiffres et _ uniquement")
        String role,
        @NotNull ConditionType condition,
        /** Usages déclenchant l'étape (condition IF_PURPOSE), ex. ["ETRANGER"]. */
        @Size(max = 20) List<@Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}") String> purposes) {
}
