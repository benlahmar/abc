package com.universite.esign.signature;

import com.universite.esign.config.EsignProperties;
import eu.europa.esig.dss.enumerations.SignatureLevel;
import eu.europa.esig.dss.pades.signature.PAdESService;
import eu.europa.esig.dss.service.crl.OnlineCRLSource;
import eu.europa.esig.dss.service.ocsp.OnlineOCSPSource;
import eu.europa.esig.dss.service.tsp.OnlineTSPSource;
import eu.europa.esig.dss.spi.validation.CertificateVerifier;
import eu.europa.esig.dss.spi.validation.CommonCertificateVerifier;
import eu.europa.esig.dss.spi.x509.CommonTrustedCertificateSource;
import eu.europa.esig.dss.spi.x509.aia.DefaultAIASource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class DssConfig {

    /**
     * Vérificateur de certificats : ancres de confiance de l'établissement et, si activé,
     * sources de révocation en ligne (nécessaires aux niveaux B-LT / B-LTA).
     */
    @Bean
    CertificateVerifier certificateVerifier(EsignProperties properties, SigningKeyProvider keys) {
        CommonTrustedCertificateSource trusted = new CommonTrustedCertificateSource();
        keys.trustAnchors().forEach(trusted::addCertificate);

        CommonCertificateVerifier verifier = new CommonCertificateVerifier();
        verifier.setTrustedCertSources(trusted);
        boolean online = properties.validation().online() || requiresRevocationData(properties);
        if (online) {
            verifier.setAIASource(new DefaultAIASource());
            verifier.setCrlSource(new OnlineCRLSource());
            verifier.setOcspSource(new OnlineOCSPSource());
        } else {
            verifier.setAIASource(null);
            verifier.setCrlSource(null);
            verifier.setOcspSource(null);
        }
        return verifier;
    }

    @Bean
    PAdESService padesService(CertificateVerifier verifier, EsignProperties properties) {
        PAdESService service = new PAdESService(verifier);
        String tsaUrl = properties.signing().tsaUrl();
        if (tsaUrl != null && !tsaUrl.isBlank()) {
            service.setTspSource(new OnlineTSPSource(tsaUrl));
        } else if (properties.signing().level() != SignatureLevel.PAdES_BASELINE_B) {
            throw new IllegalStateException("esign.signing.tsa-url est obligatoire pour le niveau "
                    + properties.signing().level());
        }
        return service;
    }

    private static boolean requiresRevocationData(EsignProperties properties) {
        return switch (properties.signing().level()) {
            case PAdES_BASELINE_LT, PAdES_BASELINE_LTA -> true;
            default -> false;
        };
    }
}
