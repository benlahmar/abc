package com.universite.esign.document.dto;

import java.time.Instant;
import java.util.UUID;

import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentStatus;
import com.universite.esign.document.DocumentType;

/** Ligne de résultat de recherche (sans les étapes d'approbation, pour rester léger). */
public record DocumentSummary(UUID id, DocumentType type, String typeLabel, DocumentStatus status, String studentCne,
                              String studentName, String academicYear, String semester, String verificationCode,
                              Instant createdAt, Instant signedAt, Instant revokedAt, String issuedByName) {

    public static DocumentSummary of(Document d) {
        return new DocumentSummary(d.getId(), d.getType(), d.getType().label(), d.getStatus(), d.getStudentCne(),
                d.getStudentName(), d.getAcademicYear(), d.getSemester(),
                d.getSignedAt() == null ? null : d.getVerificationCode(), d.getCreatedAt(), d.getSignedAt(),
                d.getRevokedAt(), d.getIssuedBy().name());
    }
}
