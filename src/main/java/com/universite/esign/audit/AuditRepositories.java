package com.universite.esign.audit;

import java.util.Optional;
import java.util.UUID;
import java.util.Collection;
import java.util.List;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    List<AuditEvent> findAllByOrderByIdAsc();

    List<AuditEvent> findByDocumentIdOrderByIdAsc(UUID documentId);

    Page<AuditEvent> findAllByOrderByIdDesc(Pageable pageable);

    Page<AuditEvent> findByEventTypeInOrderByIdDesc(Collection<String> types, Pageable pageable);
}

interface AuditChainHeadRepository extends JpaRepository<AuditChainHead, Integer> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from AuditChainHead h where h.id = " + AuditChainHead.ID)
    Optional<AuditChainHead> lockHead();
}
