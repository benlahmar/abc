package com.universite.esign.workflow;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.universite.esign.document.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface WorkflowStepRepository extends JpaRepository<WorkflowStep, Long> {

    List<WorkflowStep> findByDocumentTypeOrderByStepOrder(DocumentType type);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from WorkflowStep s where s.documentType = :type")
    void deleteByType(DocumentType type);
}

interface DocumentApprovalRepository extends JpaRepository<DocumentApproval, Long> {

    List<DocumentApproval> findByDocumentIdOrderByStepOrder(UUID documentId);

    List<DocumentApproval> findByStatusAndRoleInOrderByIdAsc(ApprovalStatus status, Collection<String> roles);
}
