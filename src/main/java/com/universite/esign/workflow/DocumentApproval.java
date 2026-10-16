package com.universite.esign.workflow;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/** Étape d'approbation d'un document (copie de l'étape du circuit au moment de la demande). */
@Entity
@Table(name = "document_approvals")
public class DocumentApproval {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 60)
    private String role;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition_type", nullable = false, length = 20)
    private ConditionType conditionType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApprovalStatus status;

    @Column(name = "decided_by_id", length = 100)
    private String decidedById;

    @Column(name = "decided_by_name", length = 200)
    private String decidedByName;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(length = 500)
    private String comment;

    @Version
    private long version;

    protected DocumentApproval() {
    }

    DocumentApproval(UUID documentId, WorkflowStep step, ApprovalStatus status) {
        this.documentId = documentId;
        this.stepOrder = step.getStepOrder();
        this.name = step.getName();
        this.role = step.getRole();
        this.conditionType = step.getConditionType();
        this.status = status;
    }

    void decide(ApprovalStatus decision, String byId, String byName, Instant at, String comment) {
        this.status = decision;
        this.decidedById = byId;
        this.decidedByName = byName;
        this.decidedAt = at;
        this.comment = comment;
    }

    void setStatus(ApprovalStatus status) {
        this.status = status;
    }

    public UUID getDocumentId() { return documentId; }
    public int getStepOrder() { return stepOrder; }
    public String getName() { return name; }
    public String getRole() { return role; }
    public ConditionType getConditionType() { return conditionType; }
    public ApprovalStatus getStatus() { return status; }
    public String getDecidedById() { return decidedById; }
    public String getDecidedByName() { return decidedByName; }
    public Instant getDecidedAt() { return decidedAt; }
    public String getComment() { return comment; }
}
