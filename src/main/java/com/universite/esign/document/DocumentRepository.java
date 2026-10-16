package com.universite.esign.document;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    Optional<Document> findByVerificationCode(String verificationCode);

    Optional<Document> findBySha256(String sha256);

    Optional<Document> findByClientIdAndIdempotencyKey(String clientId, String idempotencyKey);
}
