package com.universite.esign.signature;

import java.io.IOException;
import java.io.OutputStream;
import java.io.StringWriter;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.KeyUsage;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509ExtensionUtils;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.openssl.jcajce.JcaPEMWriter;
import org.bouncycastle.operator.OperatorCreationException;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;

/**
 * Génère une PKI de <strong>développement</strong> : une autorité de certification racine et un
 * certificat de cachet électronique émis par elle, stockés dans un fichier PKCS#12.
 * <p>
 * En production, le certificat doit être délivré par un prestataire de services de confiance
 * et la clé privée conservée dans un HSM (voir {@code esign.signing.token-type=PKCS11}).
 */
public final class DevPkiGenerator {

    private static final String SIG_ALG = "SHA256withRSA";
    private static final SecureRandom RANDOM = new SecureRandom();

    private DevPkiGenerator() {
    }

    /**
     * Écrit {@code keystorePath} (PKCS#12 contenant la clé du cachet et sa chaîne) et, à côté,
     * {@code dev-root-ca.pem} (certificat de l'AC à déclarer comme ancre de confiance).
     *
     * @return le chemin du certificat PEM de l'AC racine
     */
    public static Path generate(Path keystorePath, char[] password, String alias, String organisation)
            throws IOException, GeneralSecurityException {
        try {
            KeyPair caKeys = rsaKeyPair();
            X500Name caName = new X500Name("CN=AC Racine de TEST - " + escape(organisation)
                    + ",O=" + escape(organisation) + ",C=MA");
            Instant now = Instant.now();
            X509Certificate caCert = build(caName, caName, caKeys, caKeys.getPrivate(), caKeys,
                    now, now.plus(Duration.ofDays(3650)), true);

            KeyPair sealKeys = rsaKeyPair();
            X500Name sealName = new X500Name("CN=Cachet électronique de TEST - " + escape(organisation)
                    + ",O=" + escape(organisation) + ",C=MA");
            X509Certificate sealCert = build(caName, sealName, sealKeys, caKeys.getPrivate(), caKeys,
                    now, now.plus(Duration.ofDays(825)), false);

            KeyStore ks = KeyStore.getInstance("PKCS12");
            ks.load(null, null);
            ks.setKeyEntry(alias, sealKeys.getPrivate(), password, new Certificate[] {sealCert, caCert});

            Path parent = keystorePath.toAbsolutePath().getParent();
            Files.createDirectories(parent);
            try (OutputStream out = Files.newOutputStream(keystorePath)) {
                ks.store(out, password);
            }

            Path caPem = parent.resolve("dev-root-ca.pem");
            Files.writeString(caPem, toPem(caCert));
            return caPem;
        } catch (OperatorCreationException e) {
            throw new GeneralSecurityException("Impossible de générer la PKI de développement", e);
        }
    }

    private static KeyPair rsaKeyPair() throws GeneralSecurityException {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
        kpg.initialize(3072, RANDOM);
        return kpg.generateKeyPair();
    }

    private static X509Certificate build(X500Name issuer, X500Name subject, KeyPair subjectKeys,
                                         PrivateKey issuerKey, KeyPair issuerKeys,
                                         Instant notBefore, Instant notAfter, boolean ca)
            throws GeneralSecurityException, OperatorCreationException, IOException {
        X509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(
                issuer, new BigInteger(127, RANDOM), Date.from(notBefore), Date.from(notAfter),
                subject, subjectKeys.getPublic());
        JcaX509ExtensionUtils ext = new JcaX509ExtensionUtils();
        builder.addExtension(Extension.subjectKeyIdentifier, false,
                ext.createSubjectKeyIdentifier(subjectKeys.getPublic()));
        builder.addExtension(Extension.authorityKeyIdentifier, false,
                ext.createAuthorityKeyIdentifier(issuerKeys.getPublic()));
        if (ca) {
            builder.addExtension(Extension.basicConstraints, true, new BasicConstraints(0));
            builder.addExtension(Extension.keyUsage, true,
                    new KeyUsage(KeyUsage.keyCertSign | KeyUsage.cRLSign));
        } else {
            builder.addExtension(Extension.basicConstraints, true, new BasicConstraints(false));
            builder.addExtension(Extension.keyUsage, true,
                    new KeyUsage(KeyUsage.digitalSignature | KeyUsage.nonRepudiation));
        }
        return new JcaX509CertificateConverter()
                .getCertificate(builder.build(new JcaContentSignerBuilder(SIG_ALG).build(issuerKey)));
    }

    private static String toPem(X509Certificate cert) throws IOException {
        StringWriter sw = new StringWriter();
        try (JcaPEMWriter writer = new JcaPEMWriter(sw)) {
            writer.writeObject(cert);
        }
        return sw.toString();
    }

    private static String escape(String value) {
        return value.replaceAll("([,+=\"\\\\<>;#])", "\\\\$1");
    }
}
