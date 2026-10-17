package com.universite.esign.student;

public enum StudentRequestStatus {
    /** En attente de traitement par un agent. */
    PENDING,
    /** Document établi (signé, ou en cours d'approbation si un circuit est paramétré). */
    FULFILLED,
    /** Refusée par un agent (motif dans message). */
    REJECTED,
    /** Production automatique impossible (ex. données absentes d'Apogée) : motif dans message. */
    FAILED
}
