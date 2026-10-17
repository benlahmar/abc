package com.universite.esign.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/** Identifie l'application cliente appelante à partir de son jeton OAuth2. */
public final class CallerContext {

    public static final String ADMIN_AUTHORITY = "SCOPE_documents:admin";

    private CallerContext() {
    }

    public static String clientId(Jwt jwt) {
        for (String claim : new String[] {"azp", "client_id"}) {
            String value = jwt.getClaimAsString(claim);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return jwt.getSubject();
    }

    public static boolean isAdmin(Authentication authentication) {
        return authentication.getAuthorities().stream().anyMatch(a -> ADMIN_AUTHORITY.equals(a.getAuthority()));
    }

    /**
     * Voit tous les documents de l'établissement : scope documents:admin (application de contrôle) ou personne
     * du service de scolarité / administrateur. Une application cliente ne voit que les documents qu'elle a créés.
     */
    public static boolean seesAllDocuments(Authentication authentication) {
        return authentication.getAuthorities().stream().anyMatch(a -> switch (a.getAuthority()) {
            case ADMIN_AUTHORITY, "ROLE_AGENT_SCOLARITE", "ROLE_ESIGN_ADMIN" -> true;
            default -> false;
        });
    }
}
