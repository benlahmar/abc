package com.universite.esign.signature;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyStore.PasswordProtection;
import java.util.ArrayList;
import java.util.List;

import com.universite.esign.config.EsignProperties;
import eu.europa.esig.dss.model.x509.CertificateToken;
import eu.europa.esig.dss.spi.DSSUtils;
import eu.europa.esig.dss.token.AbstractKeyStoreTokenConnection;
import eu.europa.esig.dss.token.DSSPrivateKeyEntry;
import eu.europa.esig.dss.token.Pkcs11SignatureToken;
import eu.europa.esig.dss.token.Pkcs12SignatureToken;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Ouvre le « token » de signature (fichier PKCS#12 ou HSM PKCS#11) et expose la clé du cachet
 * électronique de l'établissement. La clé privée ne quitte jamais le token.
 */
@Component
public class SigningKeyProvider {

    private static final Logger log = LoggerFactory.getLogger(SigningKeyProvider.class);

    private final AbstractKeyStoreTokenConnection token;
    private final DSSPrivateKeyEntry key;
    private final List<CertificateToken> trustAnchors = new ArrayList<>();

    public SigningKeyProvider(EsignProperties properties) throws IOException, GeneralSecurityException {
        EsignProperties.Signing signing = properties.signing();
        this.token = switch (signing.tokenType()) {
            case PKCS12 -> openPkcs12(signing, properties.institution().university());
            case PKCS11 -> openPkcs11(signing.pkcs11());
        };
        String alias = signing.tokenType() == EsignProperties.TokenType.PKCS12
                ? signing.pkcs12().alias()
                : signing.pkcs11().alias();
        this.key = alias == null || alias.isBlank()
                ? token.getKeys().getFirst()
                : token.getKey(alias);
        if (key == null) {
            throw new IllegalStateException("Clé de signature introuvable dans le token (alias=" + alias + ")");
        }

        for (Path path : properties.validation().trustedCertificates()) {
            trustAnchors.add(DSSUtils.loadCertificate(Files.readAllBytes(path)));
        }
        // La racine de la chaîne du cachet est toujours considérée comme ancre de confiance.
        CertificateToken[] chain = key.getCertificateChain();
        trustAnchors.add(chain[chain.length - 1]);

        log.info("Cachet électronique chargé : {} (valide jusqu'au {})",
                key.getCertificate().getSubject().getPrettyPrintRFC2253(),
                key.getCertificate().getNotAfter());
    }

    private static AbstractKeyStoreTokenConnection openPkcs12(EsignProperties.Signing signing, String organisation)
            throws IOException, GeneralSecurityException {
        EsignProperties.Pkcs12 p12 = signing.pkcs12();
        if (p12 == null || p12.path() == null || p12.password() == null) {
            throw new IllegalStateException("esign.signing.pkcs12.path et password sont obligatoires");
        }
        char[] password = p12.password().toCharArray();
        if (Files.notExists(p12.path())) {
            if (!signing.devAutoGenerate()) {
                throw new IllegalStateException("Keystore introuvable : " + p12.path().toAbsolutePath());
            }
            String alias = p12.alias() == null || p12.alias().isBlank() ? "cachet" : p12.alias();
            Path ca = DevPkiGenerator.generate(p12.path(), password, alias, organisation);
            log.warn("PKI de DÉVELOPPEMENT générée : {} (AC : {}). Ne pas utiliser en production.",
                    p12.path().toAbsolutePath(), ca);
        }
        return new Pkcs12SignatureToken(p12.path().toFile(), new PasswordProtection(password));
    }

    private static AbstractKeyStoreTokenConnection openPkcs11(EsignProperties.Pkcs11 p11) {
        if (p11 == null || p11.library() == null || p11.pin() == null) {
            throw new IllegalStateException("esign.signing.pkcs11.library et pin sont obligatoires");
        }
        return new Pkcs11SignatureToken(p11.library(), new PasswordProtection(p11.pin().toCharArray()),
                p11.slotIndex());
    }

    public AbstractKeyStoreTokenConnection token() {
        return token;
    }

    public DSSPrivateKeyEntry key() {
        return key;
    }

    public List<CertificateToken> trustAnchors() {
        return List.copyOf(trustAnchors);
    }

    @PreDestroy
    void close() {
        token.close();
    }
}
