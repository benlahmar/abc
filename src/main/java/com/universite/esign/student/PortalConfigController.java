package com.universite.esign.student;

import java.util.Map;

import com.universite.esign.config.EsignProperties;
import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Configuration du portail étudiant intégré : fournisseur d'identité et client OIDC. */
@RestController
@Hidden
class PortalConfigController {

    private final Map<String, String> config;

    PortalConfigController(EsignProperties properties,
                           @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:}") String issuer) {
        this.config = Map.of(
                "issuer", issuer,
                "clientId", properties.student().portalClientId(),
                "university", properties.institution().university(),
                "faculty", properties.institution().faculty());
    }

    @GetMapping("/etudiant/config.json")
    Map<String, String> config() {
        return config;
    }
}
