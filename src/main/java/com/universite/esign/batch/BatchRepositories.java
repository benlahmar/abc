package com.universite.esign.batch;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface BatchJobRepository extends JpaRepository<BatchJob, UUID> {

    List<BatchJob> findByStatusIn(Collection<BatchStatus> statuses);

    Page<BatchJob> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<BatchJob> findByClientIdOrderByCreatedAtDesc(String clientId, Pageable pageable);
}

interface BatchItemRepository extends JpaRepository<BatchItem, Long> {

    List<BatchItem> findByJobIdOrderById(UUID jobId);

    List<BatchItem> findByJobIdAndStatusOrderById(UUID jobId, BatchItemStatus status);

    @Query("select i.id from BatchItem i where i.jobId = :jobId and i.status = :status order by i.id")
    List<Long> findIdsByJobIdAndStatus(UUID jobId, BatchItemStatus status);
}
