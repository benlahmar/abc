package com.universite.esign.storage;

/**
 * Stockage des PDF signés. L'implémentation fichier convient à un MVP ; en production,
 * préférer un stockage objet (S3 / MinIO) avec chiffrement au repos et versioning.
 */
public interface DocumentStorage {

    /** Enregistre le contenu et retourne sa clé de stockage. */
    String store(String id, byte[] content);

    byte[] load(String key);
}
