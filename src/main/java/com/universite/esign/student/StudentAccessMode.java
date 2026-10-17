package com.universite.esign.student;

/** Ce qui se passe quand un étudiant demande un document en ligne. */
public enum StudentAccessMode {
    /** Pas de demande en ligne pour ce type (l'étudiant voit quand même ses documents). */
    DISABLED,
    /** La demande arrive dans la file du service (Apogée), un agent l'établit. */
    AGENT,
    /** Le document est produit immédiatement à partir de la vue Apogée (nécessite la vue). */
    AUTO,
    /**
     * Attestations seulement : le document est produit immédiatement si l'étudiant figure (non bloqué) dans le
     * registre des inscrits de l'année ; sinon la demande va au service, comme en mode AGENT.
     */
    REGISTRY
}
