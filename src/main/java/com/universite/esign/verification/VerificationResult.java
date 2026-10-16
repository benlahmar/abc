package com.universite.esign.verification;

import java.time.Instant;
import java.util.List;

import com.universite.esign.document.DocumentStatus;
import com.universite.esign.document.DocumentType;
import com.universite.esign.signature.PadesValidationService.SignatureReport;

/**
 * Résultat public d'une vérification. Ne contient aucune note ni donnée sensible.
 *
 * @param authentic      vrai si le document est enregistré, non révoqué et (pour un fichier) identique à
 *                       l'original signé
 * @param registered     le document figure dans le registre de l'établissement
 * @param contentMatches pour un fichier déposé : son empreinte SHA-256 est celle de l'original
 * @param signatures     analyse cryptographique des signatures (fichier déposé uniquement)
 */
public record VerificationResult(
        boolean authentic,
        boolean registered,
        Boolean contentMatches,
        String message,
        DocumentInfo document,
        List<SignatureReport> signatures) {

    public record DocumentInfo(
            String verificationCode,
            DocumentType type,
            String typeLabel,
            DocumentStatus status,
            String studentName,
            String studentCne,
            String academicYear,
            String semester,
            Instant signedAt,
            String signer,
            Instant revokedAt) {
    }
}
