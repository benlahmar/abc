package com.universite.esign.workflow;

import java.util.Arrays;
import java.util.List;

import com.universite.esign.document.DocumentType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Étape du circuit paramétré pour un type de document. */
@Entity
@Table(name = "workflow_steps")
public class WorkflowStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 40)
    private DocumentType documentType;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 60)
    private String role;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition_type", nullable = false, length = 20)
    private ConditionType conditionType;

    /** Usages (séparés par des virgules) pour la condition IF_PURPOSE. */
    @Column(length = 500)
    private String purposes;

    protected WorkflowStep() {
    }

    public WorkflowStep(DocumentType documentType, int stepOrder, String name, String role,
                        ConditionType conditionType, List<String> purposes) {
        this.documentType = documentType;
        this.stepOrder = stepOrder;
        this.name = name;
        this.role = role;
        this.conditionType = conditionType;
        this.purposes = purposes == null || purposes.isEmpty() ? null : String.join(",", purposes);
    }

    public DocumentType getDocumentType() { return documentType; }
    public int getStepOrder() { return stepOrder; }
    public String getName() { return name; }
    public String getRole() { return role; }
    public ConditionType getConditionType() { return conditionType; }

    public List<String> getPurposes() {
        return purposes == null ? List.of() : Arrays.asList(purposes.split(","));
    }
}
