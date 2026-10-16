package com.universite.esign.batch;

public enum BatchStatus {
    QUEUED,
    RUNNING,
    /** Tous les documents ont été traités sans erreur. */
    COMPLETED,
    /** Traitement terminé, certains éléments sont en erreur (voir le rapport). */
    COMPLETED_WITH_ERRORS
}
