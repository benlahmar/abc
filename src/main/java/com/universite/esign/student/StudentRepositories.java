package com.universite.esign.student;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.universite.esign.document.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;

interface StudentAccessSettingRepository extends JpaRepository<StudentAccessSetting, DocumentType> {
}

interface StudentRequestRepository extends JpaRepository<StudentRequest, UUID> {

    List<StudentRequest> findByStudentCneOrderByCreatedAtDesc(String cne);

    List<StudentRequest> findByStatusOrderByCreatedAtAsc(StudentRequestStatus status);

    long countByStudentCneAndDocumentTypeAndCreatedAtAfter(String cne, DocumentType type, Instant since);
}
