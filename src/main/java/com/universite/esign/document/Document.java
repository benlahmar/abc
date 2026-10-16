package com.universite.esign.document;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * Registre d'un document délivré. Seules les données nécessaires à la vérification sont conservées
 * (principe de minimisation) ; le contenu complet est dans le PDF signé.
 */
@Entity
@Table(name = "documents")
public class Document {

    @Id
    private UUID id;

    @Column(name = "verification_code", nullable = false, unique = true, length = 32)
    private String verificationCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private DocumentType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentStatus status;

    @Column(name = "student_cne", nullable = false, length = 32)
    private String studentCne;

    @Column(name = "student_name", nullable = false, length = 210)
    private String studentName;

    @Column(name = "academic_year", nullable = false, length = 9)
    private String academicYear;

    @Column(length = 10)
    private String semester;

    @Column(name = "client_id", nullable = false, length = 100)
    private String clientId;

    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "sha256", nullable = false, length = 64)
    private String sha256;

    @Column(name = "storage_key", nullable = false, length = 200)
    private String storageKey;

    @Column(name = "signature_level", nullable = false, length = 40)
    private String signatureLevel;

    @Column(name = "signer_subject", nullable = false, length = 500)
    private String signerSubject;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "signed_at", nullable = false)
    private Instant signedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revocation_reason", length = 500)
    private String revocationReason;

    @Version
    private long version;

    protected Document() {
    }

    public Document(UUID id, String verificationCode, DocumentType type, String studentCne, String studentName,
                    String academicYear, String semester, String clientId, String idempotencyKey,
                    String requestHash, Instant createdAt) {
        this.id = id;
        this.verificationCode = verificationCode;
        this.type = type;
        this.studentCne = studentCne;
        this.studentName = studentName;
        this.academicYear = academicYear;
        this.semester = semester;
        this.clientId = clientId;
        this.idempotencyKey = idempotencyKey;
        this.requestHash = requestHash;
        this.createdAt = createdAt;
    }

    public void markSigned(String sha256, String storageKey, String signatureLevel, String signerSubject,
                           Instant signedAt) {
        this.sha256 = sha256;
        this.storageKey = storageKey;
        this.signatureLevel = signatureLevel;
        this.signerSubject = signerSubject;
        this.signedAt = signedAt;
        this.status = DocumentStatus.SIGNED;
    }

    public void revoke(String reason, Instant at) {
        if (status == DocumentStatus.REVOKED) {
            throw new IllegalStateException("Le document est déjà révoqué");
        }
        this.status = DocumentStatus.REVOKED;
        this.revocationReason = reason;
        this.revokedAt = at;
    }

    public UUID getId() { return id; }
    public String getVerificationCode() { return verificationCode; }
    public DocumentType getType() { return type; }
    public DocumentStatus getStatus() { return status; }
    public String getStudentCne() { return studentCne; }
    public String getStudentName() { return studentName; }
    public String getAcademicYear() { return academicYear; }
    public String getSemester() { return semester; }
    public String getClientId() { return clientId; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getRequestHash() { return requestHash; }
    public String getSha256() { return sha256; }
    public String getStorageKey() { return storageKey; }
    public String getSignatureLevel() { return signatureLevel; }
    public String getSignerSubject() { return signerSubject; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getSignedAt() { return signedAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public String getRevocationReason() { return revocationReason; }
}
