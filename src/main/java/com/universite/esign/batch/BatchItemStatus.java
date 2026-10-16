package com.universite.esign.batch;

public enum BatchItemStatus {
    PENDING,
    /** Document signé. */
    SIGNED,
    /** Document établi, en attente d'approbation selon le circuit paramétré. */
    AWAITING_APPROVAL,
    FAILED
}
