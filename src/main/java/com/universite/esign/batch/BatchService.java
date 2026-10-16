package com.universite.esign.batch;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.universite.esign.apogee.ApogeeAssembler.Assembled;
import com.universite.esign.audit.AuditService;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.NotFoundException;
import com.universite.esign.document.DocumentType;
import com.universite.esign.identity.Agent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** Création et suivi des traitements en masse. */
@Service
public class BatchService {

    /** Publié à la création d'un traitement ; il démarre après la validation de la transaction. */
    record BatchSubmitted(UUID jobId) {
    }

    private final BatchJobRepository jobs;
    private final BatchItemRepository items;
    private final AuditService audit;
    private final ApplicationEventPublisher events;
    private final JsonMapper json;

    BatchService(BatchJobRepository jobs, BatchItemRepository items, AuditService audit,
                 ApplicationEventPublisher events, JsonMapper json) {
        this.jobs = jobs;
        this.items = items;
        this.audit = audit;
        this.events = events;
        this.json = json;
    }

    /**
     * Enregistre un traitement : les documents valides sont mis en file d'attente, les invalides sont
     * enregistrés directement en erreur (avec les lignes concernées) sans bloquer les autres.
     */
    @Transactional
    public BatchJob submit(DocumentType type, BatchJob.Source source, String description, List<Assembled> documents,
                           String clientId, Agent issuer, String purpose) {
        if (documents.isEmpty()) {
            throw new BadRequestException("Aucune donnée à traiter");
        }
        BatchJob job = new BatchJob(UUID.randomUUID(), type, source, description, clientId, issuer, purpose);
        job.setTotal(documents.size());
        List<BatchItem> list = new ArrayList<>();
        for (Assembled a : documents) {
            if (a.valid()) {
                list.add(BatchItem.pending(job.getId(), a.key(), a.cne(), a.lines(),
                        json.writeValueAsString(a.request())));
            } else {
                list.add(BatchItem.failed(job.getId(), a.key(), a.cne(), a.lines(), String.join(" ; ", a.errors())));
                job.addFailedAtImport();
            }
        }
        jobs.save(job);
        items.saveAll(list);
        audit.record("BATCH_SUBMITTED", null, issuer.auditLabel(clientId),
                "lot " + job.getId() + " " + type + " " + source + " : " + documents.size() + " document(s), "
                        + job.getFailed() + " invalide(s) — " + job.getDescription());
        events.publishEvent(new BatchSubmitted(job.getId()));
        return job;
    }

    @Transactional(readOnly = true)
    public BatchJob get(UUID id) {
        return jobs.findById(id).orElseThrow(() -> new NotFoundException("Traitement introuvable : " + id));
    }

    @Transactional(readOnly = true)
    public List<BatchItem> items(UUID jobId, BatchItemStatus status) {
        return status == null
                ? items.findByJobIdOrderById(jobId)
                : items.findByJobIdAndStatusOrderById(jobId, status);
    }
}
