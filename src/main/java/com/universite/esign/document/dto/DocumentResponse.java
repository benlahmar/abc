package com.universite.esign.document.dto;

import java.time.Instant;
import java.util.UUID;

import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentStatus;
import com.universite.esign.document.DocumentType;

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
        String sha256,
        String signatureLevel,
        String signer,
        Instant signedAt,
        Instant revokedAt,
        String revocationReason,
        String downloadUrl) {

    public static DocumentResponse of(Document d, String verificationUrl) {
        return new DocumentResponse(d.getId(), d.getType(), d.getStatus(), d.getVerificationCode(), verificationUrl,
                d.getStudentCne(), d.getStudentName(), d.getAcademicYear(), d.getSemester(), d.getSha256(),
                d.getSignatureLevel(), d.getSignerSubject(), d.getSignedAt(), d.getRevokedAt(),
                d.getRevocationReason(), "/api/v1/documents/" + d.getId() + "/download");
    }
}
