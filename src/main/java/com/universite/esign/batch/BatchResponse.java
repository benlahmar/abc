package com.universite.esign.batch;

import java.time.Instant;
import java.util.UUID;

import com.universite.esign.document.DocumentType;
import com.universite.esign.identity.Agent;

public record BatchResponse(
        UUID id,
        DocumentType type,
        BatchJob.Source source,
        String description,
        BatchStatus status,
        int total,
        int succeeded,
        int failed,
        /** Documents restant à traiter. */
        int remaining,
        String purpose,
        Agent issuedBy,
        Instant createdAt,
        Instant startedAt,
        Instant finishedAt,
        String itemsUrl,
        String reportUrl,
        String archiveUrl) {

    static BatchResponse of(BatchJob j) {
        String base = "/api/v1/batches/" + j.getId();
        return new BatchResponse(j.getId(), j.getDocumentType(), j.getSource(), j.getDescription(), j.getStatus(),
                j.getTotal(), j.getSucceeded(), j.getFailed(), j.getTotal() - j.getSucceeded() - j.getFailed(),
                j.getPurpose(), j.getIssuedBy(), j.getCreatedAt(), j.getStartedAt(), j.getFinishedAt(),
                base + "/items", base + "/report.csv", base + "/archive.zip");
    }
}
