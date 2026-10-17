package com.universite.esign.workflow;

import java.util.List;
import java.util.UUID;

import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentService;
import com.universite.esign.document.dto.DocumentResponse;
import com.universite.esign.identity.AgentResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/approvals")
@Tag(name = "Approbations", description = "Décisions des validateurs, si le circuit paramétré en prévoit")
class ApprovalController {

    record ApproveRequest(
            @Size(max = 500) String comment,
            /** Demande une validation supplémentaire : active les étapes IF_ESCALATED suivantes. */
            Boolean escalate) {
    }

    record RejectRequest(@NotBlank @Size(max = 500) String reason) {
    }

    private final ApprovalService approvals;
    private final DocumentService documents;
    private final WorkflowService workflow;
    private final AgentResolver agents;

    ApprovalController(ApprovalService approvals, DocumentService documents, WorkflowService workflow,
                       AgentResolver agents) {
        this.approvals = approvals;
        this.documents = documents;
        this.workflow = workflow;
        this.agents = agents;
    }

    @GetMapping
    @Operation(summary = "Documents en attente de ma décision", description = "Selon les rôles de l'utilisateur connecté")
    List<ApprovalService.Task> pending(Authentication auth) {
        return approvals.pending(AgentResolver.roles(auth));
    }

    @GetMapping("/decided")
    @Operation(summary = "Mes décisions récentes (100 dernières)")
    List<ApprovalService.Decision> decided(@AuthenticationPrincipal Jwt jwt) {
        return approvals.decidedBy(agents.approver(jwt).id());
    }

    @GetMapping("/{documentId}")
    @Operation(summary = "Document soumis à ma décision (ou déjà décidé par moi), avec le déroulement du circuit")
    DocumentResponse get(@PathVariable UUID documentId, Authentication auth, @AuthenticationPrincipal Jwt jwt) {
        return response(approvals.forApprover(documentId, AgentResolver.roles(auth), agents.approver(jwt).id()));
    }

    @GetMapping(value = "/{documentId}/preview", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Prévisualiser le document (non signé) avant décision")
    ResponseEntity<byte[]> preview(@PathVariable UUID documentId, Authentication auth) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
                .body(approvals.preview(documentId, AgentResolver.roles(auth)));
    }

    @PostMapping("/{documentId}/approve")
    @Operation(summary = "Approuver l'étape en cours",
            description = "Après la dernière approbation, le document est signé automatiquement.")
    DocumentResponse approve(@PathVariable UUID documentId, @Valid @RequestBody(required = false) ApproveRequest request,
                             Authentication auth, @AuthenticationPrincipal Jwt jwt) {
        ApproveRequest r = request == null ? new ApproveRequest(null, false) : request;
        Document doc = approvals.approve(documentId, agents.approver(jwt), AgentResolver.roles(auth), r.comment(),
                Boolean.TRUE.equals(r.escalate()));
        return response(doc);
    }

    @PostMapping("/{documentId}/reject")
    @Operation(summary = "Rejeter la demande", description = "Le document ne sera jamais signé.")
    DocumentResponse reject(@PathVariable UUID documentId, @Valid @RequestBody RejectRequest request,
                            Authentication auth, @AuthenticationPrincipal Jwt jwt) {
        Document doc = approvals.reject(documentId, agents.approver(jwt), AgentResolver.roles(auth), request.reason());
        return response(doc);
    }

    private DocumentResponse response(Document doc) {
        return DocumentResponse.of(doc, workflow.approvals(doc.getId()),
                documents.verificationUrl(doc.getVerificationCode()));
    }
}
