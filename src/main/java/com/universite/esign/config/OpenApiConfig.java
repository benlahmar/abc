package com.universite.esign.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.OAuthFlow;
import io.swagger.v3.oas.models.security.OAuthFlows;
import io.swagger.v3.oas.models.security.Scopes;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class OpenApiConfig {

    @Bean
    OpenAPI openApi(@Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:}") String issuer) {
        SecurityScheme oauth2 = new SecurityScheme()
                .type(SecurityScheme.Type.OAUTH2)
                .description("Jeton obtenu par l'application cliente (grant client_credentials)")
                .flows(new OAuthFlows().clientCredentials(new OAuthFlow()
                        .tokenUrl(issuer + "/protocol/openid-connect/token")
                        .scopes(new Scopes()
                                .addString("documents:write", "Créer et signer des documents")
                                .addString("documents:read", "Consulter et télécharger ses documents")
                                .addString("documents:revoke", "Révoquer ses documents")
                                .addString("documents:admin", "Accès à tous les documents")
                                .addString("audit:read", "Consulter le journal d'audit"))));
        // Alternative : coller directement un jeton obtenu hors du navigateur (curl, requests.http…)
        SecurityScheme bearer = new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")
                .description("Jeton d'accès déjà obtenu (sans le préfixe « Bearer »)");
        return new OpenAPI()
                .info(new Info()
                        .title("API de signature électronique - Université")
                        .version("v1")
                        .description("Génération et signature électronique avancée (PAdES, certificat X.509) "
                                + "des attestations de scolarité et relevés de notes, avec vérification publique "
                                + "par QR code."))
                .components(new Components()
                        .addSecuritySchemes("oauth2", oauth2)
                        .addSecuritySchemes("bearerAuth", bearer))
                .addSecurityItem(new SecurityRequirement().addList("oauth2"))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }
}
