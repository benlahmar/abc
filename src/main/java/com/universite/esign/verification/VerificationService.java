package com.universite.esign.verification;

import java.util.List;
import java.util.Optional;

import com.universite.esign.common.Hashes;
import com.universite.esign.common.VerificationCodes;
import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentRepository;
import com.universite.esign.document.DocumentStatus;
import com.universite.esign.signature.PadesValidationService;
import com.universite.esign.signature.PadesValidationService.SignatureReport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VerificationService {

    private final DocumentRepository documents;
    private final PadesValidationService validator;

    VerificationService(DocumentRepository documents, PadesValidationService validator) {
        this.documents = documents;
        this.validator = validator;
    }

    /** Vérification par la référence imprimée / le QR code. */
    @Transactional(readOnly = true)
    public VerificationResult byCode(String code) {
        Optional<Document> found = documents.findByVerificationCode(VerificationCodes.normalize(code));
        if (found.isEmpty()) {
            return new VerificationResult(false, false, null,
                    "Aucun document ne correspond à cette référence.", null, List.of());
        }
        Document doc = found.get();
        if (doc.getSignedAt() == null) {
            // En attente d'approbation ou refusé : aucune information divulguée
            return new VerificationResult(false, false, null,
                    "Ce document n'a pas été délivré par l'établissement.", null, List.of());
        }
        boolean valid = doc.getStatus() == DocumentStatus.SIGNED;
        return new VerificationResult(valid, true, null,
                valid ? "Document authentique délivré par l'établissement."
                        : "Ce document a été révoqué par l'établissement et n'est plus valable.",
                info(doc), List.of());
    }

    /** Vérification d'un fichier PDF : empreinte comparée au registre + validation des signatures PAdES. */
    @Transactional(readOnly = true)
    public VerificationResult byFile(byte[] pdf) {
        List<SignatureReport> signatures = validator.validate(pdf);
        boolean signaturesIntact = !signatures.isEmpty()
                && signatures.stream().allMatch(SignatureReport::cryptographicallyValid);

        Optional<Document> found = documents.findBySha256(Hashes.sha256Hex(pdf));
        if (found.isEmpty()) {
            String message = signatures.isEmpty()
                    ? "Ce fichier ne contient aucune signature électronique et ne figure pas dans le registre."
                    : "Ce fichier ne correspond à aucun document original du registre "
                            + "(document modifié ou inconnu).";
            return new VerificationResult(false, false, false, message, null, signatures);
        }
        Document doc = found.get();
        boolean valid = doc.getStatus() == DocumentStatus.SIGNED && signaturesIntact;
        String message;
        if (doc.getStatus() == DocumentStatus.REVOKED) {
            message = "Ce document a été révoqué par l'établissement et n'est plus valable.";
        } else if (!signaturesIntact) {
            message = "La signature électronique de ce fichier est invalide.";
        } else {
            message = "Document authentique : fichier identique à l'original signé par l'établissement.";
        }
        return new VerificationResult(valid, true, true, message, info(doc), signatures);
    }

    private static VerificationResult.DocumentInfo info(Document d) {
        return new VerificationResult.DocumentInfo(d.getVerificationCode(), d.getType(), d.getType().label(),
                d.getStatus(), d.getStudentName(), mask(d.getStudentCne()), d.getAcademicYear(), d.getSemester(),
                d.getSignedAt(), d.getSignerSubject(), d.getRevokedAt());
    }

    /** CNE partiellement masqué sur la page publique. */
    static String mask(String cne) {
        if (cne.length() <= 4) {
            return "*".repeat(cne.length());
        }
        return cne.substring(0, 2) + "*".repeat(cne.length() - 4) + cne.substring(cne.length() - 2);
    }
}
