package com.universite.esign.audit;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
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

    @GetMapping("/documents/{id}")
    @Operation(summary = "Historique d'un document")
    List<AuditEvent> forDocument(@PathVariable UUID id) {
        return audit.forDocument(id);
    }
}
