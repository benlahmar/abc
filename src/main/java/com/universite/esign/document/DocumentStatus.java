package com.universite.esign.document;

public enum DocumentStatus {
    /** Document établi, en attente d'une ou plusieurs approbations avant signature. */
    PENDING_APPROVAL,
    /** Demande refusée lors d'une étape d'approbation : le document n'est jamais signé. */
    REJECTED,
    /** Document signé, authentique et en vigueur. */
    SIGNED,
    /** Document annulé par l'établissement (erreur de saisie, fraude…). La signature reste intacte mais le document n'a plus de valeur. */
    REVOKED
}
