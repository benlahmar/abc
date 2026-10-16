package com.universite.esign.audit;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Événement du journal d'audit. Chaque événement contient l'empreinte du précédent :
 * la suppression ou la modification d'une ligne est détectable ({@link AuditService#verifyChain()}).
 */
@Entity
@Table(name = "audit_events")
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "document_id")
    private UUID documentId;

    @Column(nullable = false, length = 150)
    private String actor;

    @Column(length = 1000)
    private String details;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "previous_hash", nullable = false, length = 64)
    private String previousHash;

    @Column(nullable = false, length = 64)
    private String hash;

    protected AuditEvent() {
    }

    AuditEvent(String eventType, UUID documentId, String actor, String details, Instant createdAt,
               String previousHash, String hash) {
        this.eventType = eventType;
        this.documentId = documentId;
        this.actor = actor;
        this.details = details;
        this.createdAt = createdAt;
        this.previousHash = previousHash;
        this.hash = hash;
    }

    public Long getId() { return id; }
    public String getEventType() { return eventType; }
    public UUID getDocumentId() { return documentId; }
    public String getActor() { return actor; }
    public String getDetails() { return details; }
    public Instant getCreatedAt() { return createdAt; }
    public String getPreviousHash() { return previousHash; }
    public String getHash() { return hash; }
}
