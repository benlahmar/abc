package com.universite.esign.document;

public enum DocumentStatus {
    /** Document signé, authentique et en vigueur. */
    SIGNED,
    /** Document annulé par l'établissement (erreur de saisie, fraude…). La signature reste intacte mais le document n'a plus de valeur. */
    REVOKED
}
