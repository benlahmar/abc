package com.universite.esign.audit;

import java.util.List;
import java.util.UUID;

import com.universite.esign.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/audit")
@Tag(name = "Audit")
class AuditController {

    private final AuditService audit;

    AuditController(AuditService audit) {
        this.audit = audit;
    }

    @GetMapping("/verify")
    @Operation(summary = "Vérifier l'intégrité du journal d'audit (chaîne d'empreintes)")
    AuditService.ChainVerification verify() {
        return audit.verifyChain();
    }

    @GetMapping("/events")
    @Operation(summary = "Journal d'audit, du plus récent au plus ancien",
            description = "type (répétable) : limiter à certains événements, ex. WORKFLOW_UPDATED, "
                    + "STUDENT_ACCESS_UPDATED pour l'historique du paramétrage.")
    PageResponse<AuditEvent> events(@RequestParam(required = false) List<String> type,
                                    @RequestParam(defaultValue = "0") @Min(0) int page,
                                    @RequestParam(defaultValue = "50") @Min(1) @Max(200) int size) {
        return PageResponse.of(audit.recent(type, page, size), e -> e);
    }

    @GetMapping("/documents/{id}")
    @Operation(summary = "Historique d'un document")
    List<AuditEvent> forDocument(@PathVariable UUID id) {
        return audit.forDocument(id);
    }
}
