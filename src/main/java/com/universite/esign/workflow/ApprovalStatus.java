package com.universite.esign.workflow;

public enum ApprovalStatus {
    /** Étape à venir. */
    WAITING,
    /** Étape à venir, appliquée seulement si une validation supplémentaire est demandée. */
    CONDITIONAL,
    /** Étape en cours : en attente de la décision du rôle concerné. */
    PENDING,
    APPROVED,
    REJECTED,
    /** Étape conditionnelle non appliquée. */
    SKIPPED;

    public boolean isOpen() {
        return this == WAITING || this == CONDITIONAL || this == PENDING;
    }
}
