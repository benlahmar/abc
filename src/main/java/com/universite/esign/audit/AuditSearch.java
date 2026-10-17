package com.universite.esign.audit;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.universite.esign.document.Document;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

/**
 * Critères de consultation du journal d'audit.
 *
 * @param types      types d'événements (vide : tous)
 * @param actor      acteur, partiel (identifiant, application…)
 * @param query      texte cherché dans le détail (motif, lot…) ou dans le document concerné (CNE, nom, référence)
 * @param documentId document concerné
 * @param from       à partir de cet instant (inclus)
 * @param to         avant cet instant (exclu)
 */
public record AuditSearch(List<String> types, String actor, String query, UUID documentId, Instant from, Instant to) {

    Specification<AuditEvent> toSpecification() {
        return (root, criteria, cb) -> {
            List<Predicate> where = new ArrayList<>();
            if (types != null && !types.isEmpty()) {
                where.add(root.get("eventType").in(types));
            }
            if (actor != null && !actor.isBlank()) {
                where.add(cb.like(cb.lower(root.get("actor")), like(actor), '\\'));
            }
            if (query != null && !query.isBlank()) {
                // Texte du détail, ou document de l'étudiant (CNE, nom, référence) : les événements d'un document
                // ne répètent pas l'identité de l'étudiant
                String q = like(query);
                Subquery<UUID> docs = criteria.subquery(UUID.class);
                Root<Document> d = docs.from(Document.class);
                docs.select(d.get("id")).where(cb.or(
                        cb.like(cb.lower(d.get("studentCne")), q, '\\'),
                        cb.like(cb.lower(d.get("studentName")), q, '\\'),
                        cb.like(cb.lower(d.get("verificationCode")), q, '\\')));
                where.add(cb.or(cb.like(cb.lower(root.get("details")), q, '\\'), root.get("documentId").in(docs)));
            }
            if (documentId != null) {
                where.add(cb.equal(root.get("documentId"), documentId));
            }
            if (from != null) {
                where.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (to != null) {
                where.add(cb.lessThan(root.get("createdAt"), to));
            }
            return cb.and(where.toArray(Predicate[]::new));
        };
    }

    private static String like(String value) {
        return "%" + value.strip().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
