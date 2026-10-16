package com.universite.esign.workflow.dto;

import java.util.List;

import com.universite.esign.document.DocumentType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Circuit d'un type de document. Une liste vide signifie : signature immédiate. */
public record WorkflowDefinition(
        DocumentType type,
        @NotNull @Size(max = 10) List<@Valid @NotNull WorkflowStepDto> steps) {
}
