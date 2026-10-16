package com.universite.esign.common;

import java.security.SecureRandom;

/**
 * Codes de vérification imprimés sur les documents : 20 caractères Crockford base32 (100 bits d'aléa),
 * non devinables, sans caractères ambigus (I, L, O, U), groupés par 5 pour la saisie manuelle.
 */
public final class VerificationCodes {

    private static final char[] ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private VerificationCodes() {
    }

    public static String generate() {
        StringBuilder sb = new StringBuilder(23);
        for (int i = 0; i < 20; i++) {
            if (i > 0 && i % 5 == 0) {
                sb.append('-');
            }
            sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }

    /** Normalise une saisie manuelle : majuscules, sans espaces, O→0, I/L→1. */
    public static String normalize(String input) {
        String compact = input.trim().toUpperCase()
                .replace('O', '0').replace('I', '1').replace('L', '1')
                .replaceAll("[\\s-]", "");
        if (compact.length() != 20) {
            return compact;
        }
        return String.join("-", compact.substring(0, 5), compact.substring(5, 10), compact.substring(10, 15),
                compact.substring(15, 20));
    }
}
