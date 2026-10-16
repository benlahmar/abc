package com.universite.esign.common;

/** Fonction non activée dans la configuration (ex. vue Oracle Apogée). */
public class FeatureDisabledException extends RuntimeException {
    public FeatureDisabledException(String message) {
        super(message);
    }
}
