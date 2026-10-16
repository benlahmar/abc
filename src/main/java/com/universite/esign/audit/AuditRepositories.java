package com.universite.esign.audit;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    List<AuditEvent> findAllByOrderByIdAsc();

    List<AuditEvent> findByDocumentIdOrderByIdAsc(UUID documentId);
}

interface AuditChainHeadRepository extends JpaRepository<AuditChainHead, Integer> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from AuditChainHead h where h.id = " + AuditChainHead.ID)
    Optional<AuditChainHead> lockHead();
}
