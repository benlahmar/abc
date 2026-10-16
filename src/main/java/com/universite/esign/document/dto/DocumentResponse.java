package com.universite.esign.document.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentStatus;
import com.universite.esign.document.DocumentType;
import com.universite.esign.identity.Agent;
import com.universite.esign.workflow.ApprovalStatus;
import com.universite.esign.workflow.DocumentApproval;

public record DocumentResponse(
        UUID id,
        DocumentType type,
        DocumentStatus status,
        String verificationCode,
        String verificationUrl,
        String studentCne,
        String studentName,
        String academicYear,
        String semester,
        String purpose,
        /** Agent qui a établi le document, et si son identité est prouvée (AUTHENTICATED) ou déclarée (DECLARED). */
        Agent issuedBy,
        Instant createdAt,
        /** Étapes du circuit d'approbation (vide si signature immédiate). */
        List<Approval> approvals,
        String sha256,
        String signatureLevel,
        String signer,
        Instant signedAt,
        Instant revokedAt,
        String revocationReason,
        /** Disponible uniquement lorsque le document est signé. */
        String downloadUrl) {

    public record Approval(int order, String name, String role, ApprovalStatus status, String decidedById,
                           String decidedByName, Instant decidedAt, String comment) {

        public static Approval of(DocumentApproval a) {
            return new Approval(a.getStepOrder(), a.getName(), a.getRole(), a.getStatus(), a.getDecidedById(),
                    a.getDecidedByName(), a.getDecidedAt(), a.getComment());
        }
    }

    public static DocumentResponse of(Document d, List<DocumentApproval> approvals, String verificationUrl) {
        boolean signed = d.getStatus() == DocumentStatus.SIGNED || d.getStatus() == DocumentStatus.REVOKED;
        return new DocumentResponse(d.getId(), d.getType(), d.getStatus(), d.getVerificationCode(),
                signed ? verificationUrl : null,
                d.getStudentCne(), d.getStudentName(), d.getAcademicYear(), d.getSemester(), d.getPurpose(),
                d.getIssuedBy(), d.getCreatedAt(), approvals.stream().map(Approval::of).toList(),
                d.getSha256(), d.getSignatureLevel(), d.getSignerSubject(), d.getSignedAt(), d.getRevokedAt(),
                d.getRevocationReason(), signed ? "/api/v1/documents/" + d.getId() + "/download" : null);
    }
}
