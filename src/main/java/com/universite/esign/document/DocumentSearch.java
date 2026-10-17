package com.universite.esign.document;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

/**
 * Critères de recherche des documents (back-office).
 *
 * @param query    CNE, nom de l'étudiant ou référence de vérification (partiel, sans tenir compte de la casse)
 * @param clientId si non null, limite aux documents créés par cette application
 */
public record DocumentSearch(String query, DocumentType type, DocumentStatus status, String academicYear,
                             String clientId) {

    Specification<Document> toSpecification() {
        return (root, criteria, cb) -> {
            List<Predicate> where = new ArrayList<>();
            if (query != null && !query.isBlank()) {
                String q = "%" + query.strip().toLowerCase(Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                where.add(cb.or(
                        cb.like(cb.lower(root.get("studentCne")), q, '\\'),
                        cb.like(cb.lower(root.get("studentName")), q, '\\'),
                        cb.like(cb.lower(root.get("verificationCode")), q, '\\')));
            }
            if (type != null) {
                where.add(cb.equal(root.get("type"), type));
            }
            if (status != null) {
                where.add(cb.equal(root.get("status"), status));
            }
            if (academicYear != null && !academicYear.isBlank()) {
                where.add(cb.equal(root.get("academicYear"), academicYear));
            }
            if (clientId != null) {
                where.add(cb.equal(root.get("clientId"), clientId));
            }
            return cb.and(where.toArray(Predicate[]::new));
        };
    }
}
