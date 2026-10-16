package com.universite.esign.workflow;

/** Condition d'application d'une étape du circuit. */
public enum ConditionType {
    /** L'étape s'applique toujours. */
    ALWAYS,
    /** L'étape s'applique si l'usage déclaré du document fait partie de la liste (ex. ETRANGER). */
    IF_PURPOSE,
    /**
     * L'étape s'applique si l'agent qui établit le document, ou un validateur précédent, a demandé une
     * validation supplémentaire ({@code escalate = true}).
     */
    IF_ESCALATED
}
