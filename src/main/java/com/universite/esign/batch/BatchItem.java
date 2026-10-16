package com.universite.esign.batch;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Un document à produire dans un traitement en masse. */
@Entity
@Table(name = "batch_items")
public class BatchItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Column(name = "item_key", nullable = false, length = 200)
    private String itemKey;

    @Column(length = 32)
    private String cne;

    @Column(name = "source_lines", nullable = false, length = 200)
    private String sourceLines;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BatchItemStatus status;

    @Column(name = "document_id")
    private UUID documentId;

    @Column(length = 2000)
    private String error;

    @Column(length = 200000)
    private String payload;

    protected BatchItem() {
    }

    static BatchItem pending(UUID jobId, String key, String cne, String lines, String payload) {
        BatchItem item = new BatchItem();
        item.jobId = jobId;
        item.itemKey = truncate(key, 200);
        item.cne = cne;
        item.sourceLines = truncate(lines, 200);
        item.status = BatchItemStatus.PENDING;
        item.payload = payload;
        return item;
    }

    static BatchItem failed(UUID jobId, String key, String cne, String lines, String error) {
        BatchItem item = pending(jobId, key, cne, lines, null);
        item.status = BatchItemStatus.FAILED;
        item.error = truncate(error, 2000);
        return item;
    }

    void succeeded(UUID documentId, boolean signed) {
        this.documentId = documentId;
        this.status = signed ? BatchItemStatus.SIGNED : BatchItemStatus.AWAITING_APPROVAL;
        this.payload = null;
    }

    void failedWith(String error) {
        this.status = BatchItemStatus.FAILED;
        this.error = truncate(error, 2000);
        this.payload = null;
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    public Long getId() { return id; }
    public UUID getJobId() { return jobId; }
    public String getItemKey() { return itemKey; }
    public String getCne() { return cne; }
    public String getSourceLines() { return sourceLines; }
    public BatchItemStatus getStatus() { return status; }
    public UUID getDocumentId() { return documentId; }
    public String getError() { return error; }
    String getPayload() { return payload; }
}
