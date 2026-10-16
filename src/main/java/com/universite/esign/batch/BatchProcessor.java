package com.universite.esign.batch;

import java.util.List;
import java.util.UUID;

import com.universite.esign.document.DocumentService;
import com.universite.esign.document.DocumentStatus;
import com.universite.esign.document.dto.CreateDocumentRequest;
import com.universite.esign.identity.Agent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Traite les éléments d'un lot un par un, chacun dans sa propre transaction : une erreur sur un
 * étudiant n'empêche pas les autres. Chaque élément a une clé d'idempotence ; après un redémarrage,
 * reprendre un lot ne crée jamais de doublon.
 */
@Component
class BatchProcessor {

    private static final Logger log = LoggerFactory.getLogger(BatchProcessor.class);

    private final BatchJobRepository jobs;
    private final BatchItemRepository items;
    private final DocumentService documents;
    private final JsonMapper json;
    private final TransactionTemplate tx;

    BatchProcessor(BatchJobRepository jobs, BatchItemRepository items, DocumentService documents, JsonMapper json,
                   PlatformTransactionManager transactionManager) {
        this.jobs = jobs;
        this.items = items;
        this.documents = documents;
        this.json = json;
        this.tx = new TransactionTemplate(transactionManager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    void run(UUID jobId) {
        BatchJob job = tx.execute(s -> {
            BatchJob j = jobs.findById(jobId).orElseThrow();
            j.start();
            return jobs.save(j);
        });
        Agent issuer = job.getIssuedBy();
        List<Long> pending = items.findIdsByJobIdAndStatus(jobId, BatchItemStatus.PENDING);
        log.info("Lot {} : {} document(s) à traiter", jobId, pending.size());

        for (Long itemId : pending) {
            BatchItem item = items.findById(itemId).orElseThrow();
            UUID documentId = null;
            boolean signed = false;
            String error = null;
            try {
                CreateDocumentRequest request = json.readValue(item.getPayload(), CreateDocumentRequest.class);
                DocumentService.CreationResult result = tx.execute(s ->
                        documents.create(request, issuer, job.getClientId(), "batch-" + itemId));
                documentId = result.document().getId();
                signed = result.document().getStatus() == DocumentStatus.SIGNED;
            } catch (RuntimeException e) {
                error = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                log.warn("Lot {} : échec pour {} : {}", jobId, item.getItemKey(), error);
            }
            UUID finalDocumentId = documentId;
            boolean finalSigned = signed;
            String finalError = error;
            tx.executeWithoutResult(s -> {
                BatchItem i = items.findById(itemId).orElseThrow();
                BatchJob j = jobs.findById(jobId).orElseThrow();
                if (finalError == null) {
                    i.succeeded(finalDocumentId, finalSigned);
                    j.recordSuccess();
                } else {
                    i.failedWith(finalError);
                    j.recordFailure();
                }
            });
        }

        tx.executeWithoutResult(s -> jobs.findById(jobId).orElseThrow().finish());
        log.info("Lot {} terminé", jobId);
    }
}
