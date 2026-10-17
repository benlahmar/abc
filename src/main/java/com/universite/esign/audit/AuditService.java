package com.universite.esign.audit;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import com.universite.esign.common.Hashes;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    static final String GENESIS = "0".repeat(64);

    private final AuditEventRepository events;
    private final AuditChainHeadRepository head;

    AuditService(AuditEventRepository events, AuditChainHeadRepository head) {
        this.events = events;
        this.head = head;
    }

    /** Ajoute un événement dans la transaction de l'opération métier (tout ou rien). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String eventType, UUID documentId, String actor, String details) {
        AuditChainHead chainHead = head.lockHead()
                .orElseThrow(() -> new IllegalStateException("Table audit_chain_head non initialisée"));
        // Troncature à la microseconde : précision commune à PostgreSQL et H2, pour que l'empreinte
        // recalculée après relecture soit identique.
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        String previous = chainHead.getLastHash();
        String hash = hash(previous, eventType, documentId, actor, details, now);
        events.save(new AuditEvent(eventType, documentId, actor, details, now, previous, hash));
        chainHead.setLastHash(hash);
    }

    /** Pour les opérations sans transaction englobante (ex. demandes étudiantes). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordInNewTransaction(String eventType, UUID documentId, String actor, String details) {
        record(eventType, documentId, actor, details);
    }

    @Transactional(readOnly = true)
    public List<AuditEvent> forDocument(UUID documentId) {
        return events.findByDocumentIdOrderByIdAsc(documentId);
    }

    /** Recalcule toute la chaîne ; retourne l'identifiant du premier événement altéré, ou null. */
    @Transactional(readOnly = true)
    public ChainVerification verifyChain() {
        String previous = GENESIS;
        List<AuditEvent> all = events.findAllByOrderByIdAsc();
        for (AuditEvent e : all) {
            String expected = hash(previous, e.getEventType(), e.getDocumentId(), e.getActor(), e.getDetails(),
                    e.getCreatedAt());
            if (!e.getPreviousHash().equals(previous) || !e.getHash().equals(expected)) {
                return new ChainVerification(false, all.size(), e.getId());
            }
            previous = e.getHash();
        }
        String recordedHead = head.findById(AuditChainHead.ID).map(AuditChainHead::getLastHash).orElse(GENESIS);
        boolean headMatches = recordedHead.equals(previous);
        return new ChainVerification(headMatches, all.size(), null);
    }

    public record ChainVerification(boolean valid, int events, Long firstInvalidEventId) {
    }

    private static String hash(String previous, String type, UUID documentId, String actor, String details,
                               Instant at) {
        return Hashes.sha256Hex(String.join("|", previous, type, String.valueOf(documentId), actor,
                String.valueOf(details), at.toString()));
    }
}
