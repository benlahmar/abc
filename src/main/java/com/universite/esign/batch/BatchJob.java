package com.universite.esign.batch;

import java.time.Instant;
import java.util.UUID;

import com.universite.esign.document.DocumentType;
import com.universite.esign.identity.Agent;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "batch_jobs")
public class BatchJob {

    public enum Source { FILE, APOGEE_VIEW }

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 40)
    private DocumentType documentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Source source;

    @Column(nullable = false, length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BatchStatus status;

    @Column(nullable = false)
    private int total;

    @Column(nullable = false)
    private int succeeded;

    @Column(nullable = false)
    private int failed;

    @Column(name = "client_id", nullable = false, length = 100)
    private String clientId;

    @Column(name = "issued_by_id", nullable = false, length = 100)
    private String issuedById;

    @Column(name = "issued_by_name", nullable = false, length = 200)
    private String issuedByName;

    @Enumerated(EnumType.STRING)
    @Column(name = "issued_by_source", nullable = false, length = 20)
    private Agent.Source issuedBySource;

    @Column(length = 40)
    private String purpose;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Version
    private long version;

    protected BatchJob() {
    }

    BatchJob(UUID id, DocumentType documentType, Source source, String description, String clientId, Agent issuer,
             String purpose) {
        this.id = id;
        this.documentType = documentType;
        this.source = source;
        this.description = description.length() > 500 ? description.substring(0, 500) : description;
        this.clientId = clientId;
        this.issuedById = issuer.id();
        this.issuedByName = issuer.name();
        this.issuedBySource = issuer.source();
        this.purpose = purpose;
        this.status = BatchStatus.QUEUED;
        this.createdAt = Instant.now();
    }

    void setTotal(int total) {
        this.total = total;
    }

    void addFailedAtImport() {
        failed++;
    }

    void start() {
        if (startedAt == null) {
            startedAt = Instant.now();
        }
        status = BatchStatus.RUNNING;
    }

    void recordSuccess() {
        succeeded++;
    }

    void recordFailure() {
        failed++;
    }

    void finish() {
        finishedAt = Instant.now();
        status = failed == 0 ? BatchStatus.COMPLETED : BatchStatus.COMPLETED_WITH_ERRORS;
    }

    public UUID getId() { return id; }
    public DocumentType getDocumentType() { return documentType; }
    public Source getSource() { return source; }
    public String getDescription() { return description; }
    public BatchStatus getStatus() { return status; }
    public int getTotal() { return total; }
    public int getSucceeded() { return succeeded; }
    public int getFailed() { return failed; }
    public String getClientId() { return clientId; }
    public Agent getIssuedBy() { return new Agent(issuedById, issuedByName, issuedBySource); }
    public String getPurpose() { return purpose; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
}
