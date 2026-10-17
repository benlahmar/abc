package com.universite.esign.identity;

/**
 * Personne à l'origine d'une action (établissement d'un document, approbation…).
 *
 * @param id     identifiant de la personne (login de l'annuaire, matricule…)
 * @param name   nom affiché
 * @param source origine de l'identité
 */
public record Agent(String id, String name, Source source) {

    public enum Source {
        /** Identité prouvée par le jeton de la personne elle-même (connexion Keycloak). */
        AUTHENTICATED,
        /** Identité déclarée par une application cliente de confiance (ex. Apogée) qui agit pour l'agent. */
        DECLARED,
        /** Établi automatiquement par la plateforme (ex. demande en libre-service d'un étudiant authentifié). */
        SYSTEM
    }

    /** Libellé pour le journal d'audit, ex. « agent.apogee (via scolarite-app) ». */
    public String auditLabel(String clientId) {
        String how = switch (source) {
            case AUTHENTICATED -> "authentifié";
            case DECLARED -> "déclaré";
            case SYSTEM -> "automatique";
        };
        return id + " (" + how + " via " + clientId + ")";
    }
}
