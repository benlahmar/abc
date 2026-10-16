package com.universite.esign.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Ligne unique portant la dernière empreinte du journal. Elle est verrouillée (SELECT … FOR UPDATE)
 * à chaque ajout pour que deux transactions concurrentes ne créent pas deux branches de la chaîne.
 */
@Entity
@Table(name = "audit_chain_head")
class AuditChainHead {

    static final int ID = 1;

    @Id
    private Integer id;

    @Column(name = "last_hash", nullable = false, length = 64)
    private String lastHash;

    protected AuditChainHead() {
    }

    String getLastHash() {
        return lastHash;
    }

    void setLastHash(String lastHash) {
        this.lastHash = lastHash;
    }
}
