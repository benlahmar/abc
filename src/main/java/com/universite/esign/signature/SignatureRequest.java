package com.universite.esign.signature;

/**
 * Informations portées par la signature PAdES.
 *
 * @param reason     motif de la signature (ex. « Attestation de scolarité »)
 * @param signerName nom affiché du signataire (l'établissement pour un cachet)
 * @param location   lieu de signature
 * @param page       page qui porte l'apparence visible de la signature (1 = première)
 * @param box        zone de l'apparence visible, ou {@code null} pour une signature invisible
 */
public record SignatureRequest(String reason, String signerName, String location, int page, Box box) {

    /** Rectangle en points PDF, origine en haut à gauche de la page (convention DSS). */
    public record Box(float x, float y, float width, float height) {
    }
}
