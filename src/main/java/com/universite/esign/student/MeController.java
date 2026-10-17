package com.universite.esign.student;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.universite.esign.common.NotFoundException;
import com.universite.esign.config.CallerContext;
import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentService;
import com.universite.esign.document.DocumentStatus;
import com.universite.esign.document.DocumentType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Espace de l'étudiant connecté (ENT, appli mobile, portail…). L'étudiant est identifié par le CNE de son
 * jeton : il ne voit et ne demande que ses propres documents.
 */
@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "Espace étudiant", description = "Avec le jeton de l'étudiant connecté (SSO de l'université)")
class MeController {

    record Profile(String cne, String username, String name, List<Offer> documentTypes) {
    }

    /** Ce que l'étudiant peut demander en ligne. */
    record Offer(DocumentType type, String label, StudentAccessMode mode, int dailyLimit) {
    }

    record MyDocument(UUID id, DocumentType type, String label, DocumentStatus status, String academicYear,
                      String semester, Instant createdAt, Instant signedAt, String verificationCode,
                      String verificationUrl, String downloadUrl, Instant revokedAt, String revocationReason) {
    }

    record NewRequest(
            @NotNull DocumentType type,
            @NotBlank @Pattern(regexp = "\\d{4}-\\d{4}", message = "format attendu : 2025-2026") String academicYear,
            @Size(max = 10) String semester,
            /** Usage du document, ex. ETRANGER. */
            @Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}") String purpose) {
    }

    record MyRequest(UUID id, DocumentType type, String label, String academicYear, String semester,
                     StudentRequestStatus status, String message, UUID documentId, Instant createdAt,
                     Instant handledAt) {
        static MyRequest of(StudentRequest r) {
            return new MyRequest(r.getId(), r.getDocumentType(), r.getDocumentType().label(), r.getAcademicYear(),
                    r.getSemester(), r.getStatus(), r.getMessage(), r.getDocumentId(), r.getCreatedAt(),
                    r.getHandledAt());
        }
    }

    private final StudentResolver students;
    private final StudentRequestService requests;
    private final StudentAccessService access;
    private final DocumentService documents;

    MeController(StudentResolver students, StudentRequestService requests, StudentAccessService access,
                 DocumentService documents) {
        this.students = students;
        this.requests = requests;
        this.access = access;
        this.documents = documents;
    }

    @GetMapping
    @Operation(summary = "Mon profil et les documents que je peux demander en ligne")
    Profile me(@AuthenticationPrincipal Jwt jwt) {
        Student s = students.resolve(jwt);
        List<Offer> offers = access.all().stream()
                .filter(a -> a.getMode() != StudentAccessMode.DISABLED)
                .map(a -> new Offer(a.getDocumentType(), a.getDocumentType().label(), a.getMode(), a.getDailyLimit()))
                .toList();
        return new Profile(s.cne(), s.username(), s.name(), offers);
    }

    @GetMapping("/documents")
    @Operation(summary = "Mes documents", description = "Signés, révoqués ou en cours de validation")
    List<MyDocument> myDocuments(@AuthenticationPrincipal Jwt jwt) {
        Student s = students.resolve(jwt);
        return documents.forStudent(s.cne()).stream()
                .filter(d -> d.getStatus() != DocumentStatus.REJECTED)
                .map(this::view)
                .toList();
    }

    @GetMapping(value = "/documents/{id}/download", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Télécharger un de mes documents signés")
    ResponseEntity<byte[]> download(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Student s = students.resolve(jwt);
        Document d = documents.get(id);
        if (!d.getStudentCne().equalsIgnoreCase(s.cne()) || d.getStatus() != DocumentStatus.SIGNED) {
            throw new NotFoundException("Document introuvable : " + id);
        }
        String filename = d.getType().name().toLowerCase() + "-" + d.getAcademicYear()
                + (d.getSemester() == null ? "" : "-" + d.getSemester()) + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(documents.content(d));
    }

    @PostMapping("/requests")
    @Operation(summary = "Demander un document",
            description = "Selon le paramétrage : produit immédiatement depuis Apogée (statut FULFILLED, ou FAILED "
                    + "avec le motif), ou transmis au service de scolarité (statut PENDING).")
    ResponseEntity<MyRequest> request(@Valid @RequestBody NewRequest body, @AuthenticationPrincipal Jwt jwt) {
        Student s = students.resolve(jwt);
        StudentRequest r = requests.request(s, body.type(), body.academicYear(), body.semester(), body.purpose(),
                CallerContext.clientId(jwt));
        return ResponseEntity.status(HttpStatus.CREATED).body(MyRequest.of(r));
    }

    @GetMapping("/requests")
    @Operation(summary = "Mes demandes et leur état")
    List<MyRequest> myRequests(@AuthenticationPrincipal Jwt jwt) {
        return requests.mine(students.resolve(jwt)).stream().map(MyRequest::of).toList();
    }

    private MyDocument view(Document d) {
        boolean signed = d.getSignedAt() != null;
        return new MyDocument(d.getId(), d.getType(), d.getType().label(), d.getStatus(), d.getAcademicYear(),
                d.getSemester(), d.getCreatedAt(), d.getSignedAt(),
                signed ? d.getVerificationCode() : null,
                signed ? documents.verificationUrl(d.getVerificationCode()) : null,
                d.getStatus() == DocumentStatus.SIGNED ? "/api/v1/me/documents/" + d.getId() + "/download" : null,
                d.getRevokedAt(), d.getRevocationReason());
    }
}
