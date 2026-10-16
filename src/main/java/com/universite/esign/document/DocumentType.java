package com.universite.esign.document;

public enum DocumentType {
    ATTESTATION_SCOLARITE("Attestation de scolarité"),
    RELEVE_NOTES("Relevé de notes");

    private final String label;

    DocumentType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
