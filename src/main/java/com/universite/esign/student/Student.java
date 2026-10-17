package com.universite.esign.student;

/** Étudiant authentifié, identifié par le CNE figurant dans son jeton (jamais par un paramètre de requête). */
public record Student(String cne, String username, String name) {
}
