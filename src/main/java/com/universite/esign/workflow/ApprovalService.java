package com.universite.esign.workflow;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.universite.esign.audit.AuditService;
import com.universite.esign.common.ConflictException;
import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentService;
import com.universite.esign.document.DocumentStatus;
import com.universite.esign.identity.Agent;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Décisions des validateurs sur les documents en attente d'approbation. */
@Service
public class ApprovalService {

    private final DocumentService documents;
    private final WorkflowService workflow;
    private final AuditService audit;

    ApprovalService(DocumentService documents, WorkflowService workflow, AuditService audit) {
        this.documents = documents;
        this.workflow = workflow;
        this.audit = audit;
    }

    /** Une tâche d'approbation à traiter par l'un des rôles de l'appelant. */
    public record Task(UUID documentId, String documentType, String studentName, String studentCne,
                       String academicYear, String semester, String purpose, String step, String role,
                       Agent issuedBy, Instant requestedAt) {
    }

    @Transactional(readOnly = true)
    public List<Task> pending(Set<String> roles) {
        return workflow.pendingFor(roles).stream().map(a -> {
            Document d = documents.get(a.getDocumentId());
            return new Task(d.getId(), d.getType().label(), d.getStudentName(), d.getStudentCne(),
                    d.getAcademicYear(), d.getSemester(), d.getPurpose(), a.getName(), a.getRole(),
                    d.getIssuedBy(), d.getCreatedAt());
        }).toList();
    }

    /** PDF non signé, visible uniquement par les personnes qui doivent décider de l'étape en cours. */
    @Transactional(readOnly = true)
    public byte[] preview(UUID documentId, Set<String> roles) {
        Document document = documents.get(documentId);
        currentStepFor(document, roles);
        return documents.unsignedContent(document);
    }

    @Transactional
    public Document approve(UUID documentId, Agent approver, Set<String> roles, String comment, boolean escalate) {
        Document document = documents.get(documentId);
        List<DocumentApproval> plan = workflow.approvals(documentId);
        DocumentApproval step = currentStepFor(document, roles, plan);
        checkSeparationOfDuties(document, approver);
        if (escalate) {
            document.escalate();
        }
        boolean completed = workflow.approve(plan, approver.id(), approver.name(), comment, document.isEscalated());
        audit.record("STEP_APPROVED", documentId, approver.auditLabel("approbation"),
                step.getName() + (comment == null ? "" : " : " + comment)
                        + (escalate ? " (validation supplémentaire demandée)" : ""));
        if (completed) {
            documents.signApproved(document);
        }
        return document;
    }

    @Transactional
    public Document reject(UUID documentId, Agent approver, Set<String> roles, String reason) {
        Document document = documents.get(documentId);
        List<DocumentApproval> plan = workflow.approvals(documentId);
        DocumentApproval step = currentStepFor(document, roles, plan);
        checkSeparationOfDuties(document, approver);
        workflow.reject(plan, approver.id(), approver.name(), reason);
        document.markRejected();
        audit.record("STEP_REJECTED", documentId, approver.auditLabel("approbation"),
                step.getName() + " : " + reason);
        return document;
    }

    private DocumentApproval currentStepFor(Document document, Set<String> roles) {
        return currentStepFor(document, roles, workflow.approvals(document.getId()));
    }

    private static DocumentApproval currentStepFor(Document document, Set<String> roles,
                                                   List<DocumentApproval> plan) {
        if (document.getStatus() != DocumentStatus.PENDING_APPROVAL) {
            throw new ConflictException("Le document n'est pas en attente d'approbation (statut "
                    + document.getStatus() + ")");
        }
        DocumentApproval current = WorkflowService.current(plan);
        if (current == null || !roles.contains(current.getRole())) {
            throw new AccessDeniedException("L'étape en cours doit être décidée par le rôle "
                    + (current == null ? "?" : current.getRole()));
        }
        return current;
    }

    /** La personne qui a établi le document ne peut pas l'approuver elle-même. */
    private static void checkSeparationOfDuties(Document document, Agent approver) {
        if (document.getIssuedBy().id().equalsIgnoreCase(approver.id())) {
            throw new AccessDeniedException("L'agent qui a établi le document ne peut pas l'approuver");
        }
    }
}
