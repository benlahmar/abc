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
}
