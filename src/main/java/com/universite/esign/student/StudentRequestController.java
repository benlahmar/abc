package com.universite.esign.student;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.universite.esign.config.CallerContext;
import com.universite.esign.document.DocumentType;
import com.universite.esign.document.dto.CreateDocumentRequest;
import com.universite.esign.document.dto.IssuedBy;
import com.universite.esign.identity.Agent;
import com.universite.esign.identity.AgentResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** File des demandes étudiantes, traitée par le service de scolarité (Apogée). */
@RestController
@RequestMapping("/api/v1/student-requests")
@Tag(name = "Demandes étudiantes (agents)", description = "Demandes faites en ligne par les étudiants (mode AGENT)")
class StudentRequestController {

    record RequestView(UUID id, String studentCne, String studentName, String studentUsername, DocumentType type,
                       String label, String academicYear, String semester, String purpose, StudentRequestStatus status,
                       UUID documentId, String handledByName, Instant handledAt, String message, Instant createdAt) {
        static RequestView of(StudentRequest r) {
            return new RequestView(r.getId(), r.getStudentCne(), r.getStudentName(), r.getStudentUsername(),
                    r.getDocumentType(), r.getDocumentType().label(), r.getAcademicYear(), r.getSemester(),
                    r.getPurpose(), r.getStatus(), r.getDocumentId(), r.getHandledByName(), r.getHandledAt(),
                    r.getMessage(), r.getCreatedAt());
        }
    }

    record AgentOnly(@Valid IssuedBy issuedBy) {
    }

    record Rejection(@NotBlank @Size(max = 1000) String reason, @Valid IssuedBy by) {
    }

    private final StudentRequestService requests;
    private final AgentResolver agents;

    StudentRequestController(StudentRequestService requests, AgentResolver agents) {
        this.requests = requests;
        this.agents = agents;
    }

    @GetMapping
    @Operation(summary = "Demandes en attente (par défaut, de la plus ancienne à la plus récente) ou traitées",
            description = "status=FULFILLED, REJECTED ou FAILED : les 200 dernières, de la plus récente à la plus ancienne.")
    List<RequestView> list(@RequestParam(required = false) StudentRequestStatus status) {
        List<StudentRequest> list = status == null || status == StudentRequestStatus.PENDING
                ? requests.pending()
                : requests.handled(status);
        return list.stream().map(RequestView::of).toList();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Détail d'une demande")
    RequestView get(@PathVariable UUID id) {
        return RequestView.of(requests.get(id));
    }

    @PostMapping("/{id}/fulfill-from-apogee")
    @Operation(summary = "Établir le document à partir de la vue Apogée (sans ressaisie)")
    RequestView fulfillFromApogee(@PathVariable UUID id, @Valid @RequestBody(required = false) AgentOnly body,
                                  @AuthenticationPrincipal Jwt jwt) {
        Agent agent = agents.issuer(jwt, body == null ? null : body.issuedBy());
        return RequestView.of(requests.fulfillFromApogee(id, agent, CallerContext.clientId(jwt)));
    }

    @PostMapping("/{id}/fulfill")
    @Operation(summary = "Établir le document à partir des données fournies",
            description = "Type, CNE, année et semestre doivent correspondre à la demande.")
    RequestView fulfill(@PathVariable UUID id, @Valid @RequestBody CreateDocumentRequest data,
                        @AuthenticationPrincipal Jwt jwt) {
        Agent agent = agents.issuer(jwt, data.issuedBy());
        return RequestView.of(requests.fulfill(id, data, agent, CallerContext.clientId(jwt)));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Refuser la demande (motif visible par l'étudiant)")
    RequestView reject(@PathVariable UUID id, @Valid @RequestBody Rejection body, @AuthenticationPrincipal Jwt jwt) {
        Agent agent = agents.issuer(jwt, body.by());
        return RequestView.of(requests.reject(id, agent, CallerContext.clientId(jwt), body.reason()));
    }
}
