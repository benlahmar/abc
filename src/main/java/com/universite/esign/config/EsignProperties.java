package com.universite.esign.config;

import java.nio.file.Path;
import java.time.ZoneId;
import java.util.List;

import eu.europa.esig.dss.enumerations.SignatureLevel;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuration métier de la plateforme, préfixe {@code esign.*}.
 */
@ConfigurationProperties(prefix = "esign")
public record EsignProperties(
        String publicBaseUrl,
        Institution institution,
        Signing signing,
        Validation validation,
        Storage storage,
        @DefaultValue Issuance issuance) {

    /**
     * @param requireAgent une application qui appelle l'API avec son propre jeton (ex. Apogée) doit
     *                     déclarer l'agent qui établit le document ({@code issuedBy})
     */
    public record Issuance(@DefaultValue("true") boolean requireAgent) {
    }

    public record Institution(
            @DefaultValue("Université Exemple") String university,
            @DefaultValue("Faculté des Sciences") String faculty,
            @DefaultValue("Ville") String city,
            @DefaultValue("Le Doyen") String signatoryTitle,
            @DefaultValue("Africa/Casablanca") ZoneId zone) {
    }

    public enum TokenType { PKCS12, PKCS11 }

    public record Signing(
            @DefaultValue("PKCS12") TokenType tokenType,
            @DefaultValue("PAdES_BASELINE_B") SignatureLevel level,
            /** URL d'une autorité d'horodatage RFC 3161, obligatoire à partir du niveau B-T. */
            String tsaUrl,
            Pkcs12 pkcs12,
            Pkcs11 pkcs11,
            /** Génère une PKI de test (AC + certificat de cachet) si le keystore est absent. Jamais en production. */
            @DefaultValue("false") boolean devAutoGenerate) {
    }

    public record Pkcs12(Path path, String password, String alias) {
    }

    public record Pkcs11(String library, @DefaultValue("0") int slotIndex, String pin, String alias) {
    }

    public record Validation(
            /** Certificats (PEM/DER) des autorités de confiance utilisées pour valider les signatures. */
            @DefaultValue List<Path> trustedCertificates,
            /** Autorise l'accès réseau (AIA, CRL, OCSP) pendant la validation. */
            @DefaultValue("false") boolean online) {
    }

    public record Storage(@DefaultValue("./data/storage") Path baseDir) {
    }
}
