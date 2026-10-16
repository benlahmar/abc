package com.universite.esign.signature;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import eu.europa.esig.dss.diagnostic.DiagnosticData;
import eu.europa.esig.dss.diagnostic.SignatureWrapper;
import eu.europa.esig.dss.enumerations.Indication;
import eu.europa.esig.dss.enumerations.SubIndication;
import eu.europa.esig.dss.model.InMemoryDocument;
import eu.europa.esig.dss.simplereport.SimpleReport;
import eu.europa.esig.dss.spi.validation.CertificateVerifier;
import eu.europa.esig.dss.validation.SignedDocumentValidator;
import eu.europa.esig.dss.validation.reports.Reports;
import org.springframework.stereotype.Service;

/**
 * Valide les signatures d'un PDF avec la politique de validation par défaut d'EU DSS (ETSI EN 319 102-1).
 */
@Service
public class PadesValidationService {

    private final CertificateVerifier verifier;

    public PadesValidationService(CertificateVerifier verifier) {
        this.verifier = verifier;
    }

    /**
     * @throws UnsupportedDocumentException si le fichier n'est pas un document signé reconnu
     */
    public List<SignatureReport> validate(byte[] pdf) {
        SignedDocumentValidator validator;
        try {
            validator = SignedDocumentValidator.fromDocument(new InMemoryDocument(pdf, "document.pdf"));
        } catch (UnsupportedOperationException e) {
            throw new UnsupportedDocumentException("Format de document non reconnu");
        }
        validator.setCertificateVerifier(verifier);
        Reports reports = validator.validateDocument();
        SimpleReport simple = reports.getSimpleReport();
        DiagnosticData diagnostic = reports.getDiagnosticData();

        List<SignatureReport> result = new ArrayList<>();
        for (String id : simple.getSignatureIdList()) {
            SignatureWrapper signature = diagnostic.getSignatureById(id);
            Date signingTime = simple.getSigningTime(id);
            SubIndication sub = simple.getSubIndication(id);
            result.add(new SignatureReport(
                    id,
                    simple.getSignatureFormat(id) == null ? null : simple.getSignatureFormat(id).name(),
                    simple.getSignedBy(id),
                    signingTime == null ? null : signingTime.toInstant(),
                    signature != null && signature.isSignatureIntact() && signature.isSignatureValid(),
                    simple.getIndication(id),
                    sub));
        }
        return result;
    }

    /**
     * @param cryptographicallyValid la signature correspond exactement aux octets signés (aucune altération)
     * @param indication             conclusion ETSI : TOTAL_PASSED, INDETERMINATE (ex. pas de données
     *                               de révocation pour un certificat de test) ou TOTAL_FAILED
     */
    public record SignatureReport(String id, String format, String signedBy, Instant signingTime,
                                  boolean cryptographicallyValid,
                                  Indication indication, SubIndication subIndication) {
    }

    public static class UnsupportedDocumentException extends RuntimeException {
        public UnsupportedDocumentException(String message) {
            super(message);
        }
    }
}
