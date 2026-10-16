package com.universite.esign.apogee;

import java.util.List;

import com.universite.esign.apogee.ApogeeAssembler.Assembled;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.FeatureDisabledException;
import com.universite.esign.common.NotFoundException;
import com.universite.esign.config.CallerContext;
import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentService;
import com.universite.esign.document.DocumentType;
import com.universite.esign.document.dto.DocumentResponse;
import com.universite.esign.document.dto.IssuedBy;
import com.universite.esign.identity.Agent;
import com.universite.esign.identity.AgentResolver;
import com.universite.esign.workflow.WorkflowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/apogee")
@Tag(name = "Apogée", description = "Documents établis directement à partir des données d'Apogée")
class ApogeeController {

    record FromApogeeRequest(
            @NotNull DocumentType type,
            @NotBlank @Size(max = 32) String cne,
            @NotBlank @Pattern(regexp = "\\d{4}-\\d{4}", message = "format attendu : 2025-2026") String academicYear,
            /** Obligatoire pour un relevé de notes. */
            @Size(max = 10) String semester,
            @Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}") String purpose,
            @Valid IssuedBy issuedBy) {
    }

    private final ObjectProvider<ApogeeViewClient> view;
    private final ApogeeAssembler assembler;
    private final DocumentService documents;
    private final WorkflowService workflow;
    private final AgentResolver agents;

    ApogeeController(ObjectProvider<ApogeeViewClient> view, ApogeeAssembler assembler, DocumentService documents,
                     WorkflowService workflow, AgentResolver agents) {
        this.view = view;
        this.assembler = assembler;
        this.documents = documents;
        this.workflow = workflow;
        this.agents = agents;
    }

    @PostMapping("/documents")
    @Operation(summary = "Établir un document à partir de la vue Apogée",
            description = "L'agent indique seulement le CNE, l'année et le semestre : les notes sont lues dans "
                    + "Apogée, sans ressaisie. Nécessite esign.apogee.view.enabled=true.")
    ResponseEntity<DocumentResponse> create(
            @Valid @RequestBody FromApogeeRequest request,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal Jwt jwt) {
        ApogeeViewClient client = view.getIfAvailable();
        if (client == null) {
            throw new FeatureDisabledException("La vue Oracle Apogée n'est pas activée (esign.apogee.view.enabled)");
        }
        boolean transcript = request.type() == DocumentType.RELEVE_NOTES;
        if (transcript && (request.semester() == null || request.semester().isBlank())) {
            throw new BadRequestException("Le semestre est obligatoire pour un relevé de notes");
        }
        Agent issuer = agents.issuer(jwt, request.issuedBy());
        List<ApogeeRow> rows = client.find(request.academicYear(), transcript ? request.semester() : null, null,
                request.cne());
        if (rows.isEmpty()) {
            throw new NotFoundException("Aucune donnée Apogée pour " + request.cne() + " / " + request.academicYear()
                    + (transcript ? " / " + request.semester() : ""));
        }
        List<Assembled> assembled = assembler.assemble(request.type(), rows, request.purpose(),
                new IssuedBy(issuer.id(), issuer.name()));
        // Pour une attestation, plusieurs lignes (modules) concernent le même étudiant : un seul document
        Assembled doc = assembled.getFirst();
        if (!doc.valid()) {
            throw new BadRequestException("Données Apogée incomplètes : " + String.join(" ; ", doc.errors()));
        }
        DocumentService.CreationResult result =
                documents.create(doc.request(), issuer, CallerContext.clientId(jwt), idempotencyKey);
        Document d = result.document();
        DocumentResponse body = DocumentResponse.of(d, workflow.approvals(d.getId()),
                documents.verificationUrl(d.getVerificationCode()));
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(body);
    }
}
