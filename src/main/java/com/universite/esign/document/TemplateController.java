package com.universite.esign.document;

import java.util.Arrays;
import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Modèles")
class TemplateController {

    record TemplateInfo(DocumentType type, String label, List<String> requiredFields) {
    }

    @GetMapping("/api/v1/templates")
    @Operation(summary = "Lister les types de documents disponibles")
    List<TemplateInfo> templates() {
        return Arrays.stream(DocumentType.values())
                .map(t -> new TemplateInfo(t, t.label(), switch (t) {
                    case ATTESTATION_SCOLARITE -> List.of("student", "academicYear");
                    case RELEVE_NOTES -> List.of("student", "academicYear", "semester", "grades");
                }))
                .toList();
    }
}
