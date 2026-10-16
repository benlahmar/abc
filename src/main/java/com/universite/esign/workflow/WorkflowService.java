package com.universite.esign.workflow;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.universite.esign.audit.AuditService;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.document.DocumentType;
import com.universite.esign.workflow.dto.WorkflowDefinition;
import com.universite.esign.workflow.dto.WorkflowStepDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paramétrage et déroulement du circuit d'approbation.
 * <p>
 * Le circuit est défini par type de document (étapes ordonnées, chacune avec un rôle et une condition).
 * À la demande d'un document, le circuit est <em>copié</em> dans {@link DocumentApproval} : modifier le
 * paramétrage n'affecte que les demandes suivantes.
 */
@Service
public class WorkflowService {

    private final WorkflowStepRepository steps;
    private final DocumentApprovalRepository approvals;
    private final AuditService audit;

    WorkflowService(WorkflowStepRepository steps, DocumentApprovalRepository approvals, AuditService audit) {
        this.steps = steps;
        this.approvals = approvals;
        this.audit = audit;
    }

    // ---------------------------------------------------------------- paramétrage

    @Transactional(readOnly = true)
    public WorkflowDefinition definition(DocumentType type) {
        return new WorkflowDefinition(type, steps.findByDocumentTypeOrderByStepOrder(type).stream()
                .map(s -> new WorkflowStepDto(s.getName(), s.getRole(), s.getConditionType(),
                        s.getConditionType() == ConditionType.IF_PURPOSE ? s.getPurposes() : null))
                .toList());
    }

    @Transactional
    public WorkflowDefinition update(DocumentType type, List<WorkflowStepDto> newSteps, String actor) {
        for (WorkflowStepDto step : newSteps) {
            boolean hasPurposes = step.purposes() != null && !step.purposes().isEmpty();
            if (step.condition() == ConditionType.IF_PURPOSE && !hasPurposes) {
                throw new BadRequestException("L'étape « " + step.name() + " » (IF_PURPOSE) doit indiquer "
                        + "au moins un usage dans purposes");
            }
            if (step.condition() != ConditionType.IF_PURPOSE && hasPurposes) {
                throw new BadRequestException("purposes n'est utilisé qu'avec la condition IF_PURPOSE "
                        + "(étape « " + step.name() + " »)");
            }
        }
        steps.deleteByType(type);
        int order = 1;
        for (WorkflowStepDto s : newSteps) {
            steps.save(new WorkflowStep(type, order++, s.name(), s.role(), s.condition(), s.purposes()));
        }
        WorkflowDefinition result = definition(type);
        audit.record("WORKFLOW_UPDATED", null, actor, type + " : " + describe(result));
        return result;
    }

    private static String describe(WorkflowDefinition definition) {
        if (definition.steps().isEmpty()) {
            return "aucune étape (signature immédiate)";
        }
        List<String> parts = new ArrayList<>();
        for (WorkflowStepDto s : definition.steps()) {
            parts.add(s.role() + "[" + s.condition()
                    + (s.purposes() == null ? "" : ":" + String.join("|", s.purposes())) + "]");
        }
        return String.join(" -> ", parts);
    }

    // ---------------------------------------------------------------- déroulement

    /**
     * Copie le circuit pour un nouveau document et active la première étape applicable.
     *
     * @return les étapes ; aucune étape ouverte signifie que le document peut être signé immédiatement
     */
    @Transactional
    public List<DocumentApproval> start(UUID documentId, DocumentType type, String purpose, boolean escalated) {
        List<DocumentApproval> plan = new ArrayList<>();
        for (WorkflowStep step : steps.findByDocumentTypeOrderByStepOrder(type)) {
            switch (step.getConditionType()) {
                case ALWAYS -> plan.add(new DocumentApproval(documentId, step, ApprovalStatus.WAITING));
                case IF_PURPOSE -> {
                    if (purpose != null && step.getPurposes().contains(purpose)) {
                        plan.add(new DocumentApproval(documentId, step, ApprovalStatus.WAITING));
                    }
                }
                case IF_ESCALATED -> plan.add(new DocumentApproval(documentId, step, ApprovalStatus.CONDITIONAL));
            }
        }
        advance(plan, escalated);
        return approvals.saveAll(plan);
    }

    @Transactional(readOnly = true)
    public List<DocumentApproval> approvals(UUID documentId) {
        return approvals.findByDocumentIdOrderByStepOrder(documentId);
    }

    @Transactional(readOnly = true)
    public List<DocumentApproval> pendingFor(Collection<String> roles) {
        if (roles.isEmpty()) {
            return List.of();
        }
        return approvals.findByStatusAndRoleInOrderByIdAsc(ApprovalStatus.PENDING, roles);
    }

    /** Étape en cours d'un document, ou null. */
    public static DocumentApproval current(List<DocumentApproval> plan) {
        return plan.stream().filter(a -> a.getStatus() == ApprovalStatus.PENDING).findFirst().orElse(null);
    }

    /**
     * Enregistre l'approbation de l'étape en cours et active la suivante.
     *
     * @return vrai si toutes les étapes sont terminées (le document peut être signé)
     */
    @Transactional
    public boolean approve(List<DocumentApproval> plan, String byId, String byName, String comment,
                           boolean escalated) {
        DocumentApproval current = current(plan);
        current.decide(ApprovalStatus.APPROVED, byId, byName, Instant.now(), comment);
        advance(plan, escalated);
        approvals.saveAll(plan);
        return current(plan) == null;
    }

    @Transactional
    public void reject(List<DocumentApproval> plan, String byId, String byName, String reason) {
        current(plan).decide(ApprovalStatus.REJECTED, byId, byName, Instant.now(), reason);
        for (DocumentApproval a : plan) {
            if (a.getStatus() == ApprovalStatus.WAITING || a.getStatus() == ApprovalStatus.CONDITIONAL) {
                a.setStatus(ApprovalStatus.SKIPPED);
            }
        }
        approvals.saveAll(plan);
    }

    /**
     * Active l'étape suivante : les étapes conditionnelles rencontrées sont appliquées si une validation
     * supplémentaire a été demandée, ignorées sinon ; la première étape applicable devient PENDING.
     */
    static void advance(List<DocumentApproval> plan, boolean escalated) {
        for (DocumentApproval a : plan) {
            if (a.getStatus() == ApprovalStatus.PENDING) {
                return;
            }
            if (a.getStatus() == ApprovalStatus.CONDITIONAL) {
                a.setStatus(escalated ? ApprovalStatus.WAITING : ApprovalStatus.SKIPPED);
            }
            if (a.getStatus() == ApprovalStatus.WAITING) {
                a.setStatus(ApprovalStatus.PENDING);
                return;
            }
        }
    }
}
