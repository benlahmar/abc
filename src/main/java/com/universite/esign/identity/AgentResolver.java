package com.universite.esign.identity;

import java.util.Set;
import java.util.stream.Collectors;

import com.universite.esign.common.BadRequestException;
import com.universite.esign.config.CallerContext;
import com.universite.esign.config.EsignProperties;
import com.universite.esign.document.dto.IssuedBy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Détermine la personne qui agit.
 * <ul>
 *   <li>Jeton <em>utilisateur</em> (l'agent s'est connecté) : l'identité vient du jeton, elle est prouvée.</li>
 *   <li>Jeton <em>applicatif</em> (client_credentials, ex. Apogée) : l'application doit déclarer l'agent
 *       dans {@code issuedBy} ; l'identité est enregistrée comme déclarée par cette application.</li>
 * </ul>
 */
@Component
public class AgentResolver {

    private static final String SERVICE_ACCOUNT_PREFIX = "service-account-";

    private final boolean requireAgent;

    public AgentResolver(EsignProperties properties) {
        this.requireAgent = properties.issuance().requireAgent();
    }

    public static boolean isUserToken(Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        return username != null && !username.isBlank() && !username.startsWith(SERVICE_ACCOUNT_PREFIX);
    }

    /** Agent qui établit un document. */
    public Agent issuer(Jwt jwt, IssuedBy declared) {
        if (isUserToken(jwt)) {
            // Le jeton fait foi : une éventuelle déclaration dans la requête est ignorée.
            return fromToken(jwt);
        }
        if (declared == null) {
            if (requireAgent) {
                throw new BadRequestException("issuedBy est obligatoire pour une application : indiquer "
                        + "l'identifiant et le nom de l'agent qui établit le document");
            }
            String clientId = CallerContext.clientId(jwt);
            return new Agent(clientId, clientId, Agent.Source.DECLARED);
        }
        return new Agent(declared.id(), declared.name(), Agent.Source.DECLARED);
    }

    /** Personne qui approuve : elle doit être connectée avec son propre compte. */
    public Agent approver(Jwt jwt) {
        if (!isUserToken(jwt)) {
            throw new AccessDeniedException(
                    "Une approbation doit être faite par une personne connectée avec son propre compte");
        }
        return fromToken(jwt);
    }

    /** Rôles métier (realm roles Keycloak) de l'appelant, sans le préfixe ROLE_. */
    public static Set<String> roles(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring("ROLE_".length()))
                .collect(Collectors.toSet());
    }

    private static Agent fromToken(Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        String name = jwt.getClaimAsString("name");
        return new Agent(username, name == null || name.isBlank() ? username : name, Agent.Source.AUTHENTICATED);
    }
}
