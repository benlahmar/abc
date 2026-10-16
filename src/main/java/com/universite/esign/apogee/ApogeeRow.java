package com.universite.esign.apogee;

import java.util.Map;

import com.universite.esign.apogee.ApogeeProperties.Field;

/**
 * Une ligne Apogée : un étudiant et (pour un relevé) un module.
 *
 * @param line   numéro de ligne dans le fichier (1 = en-têtes) ou rang dans la vue
 * @param values valeurs brutes par donnée, déjà nettoyées (null si vide)
 */
public record ApogeeRow(int line, Map<Field, String> values) {

    public String get(Field field) {
        return values.get(field);
    }
}
