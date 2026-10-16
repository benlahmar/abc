package com.universite.esign.apogee;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Raccordement à Apogée, préfixe {@code esign.apogee.*}.
 * <p>
 * Les noms de colonnes des exports (CSV/Excel) et de la vue Oracle sont paramétrables : il suffit
 * d'indiquer, pour chaque donnée attendue, le nom de la colonne côté Apogée.
 */
@ConfigurationProperties(prefix = "esign.apogee")
public record ApogeeProperties(
        @DefaultValue Columns columns,
        @DefaultValue View view,
        /** Nombre maximal de lignes par import ou par extraction. */
        @DefaultValue("20000") int maxRows) {

    private static final Pattern SQL_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_$#]{0,127}");

    /** Nom de colonne Apogée de chaque donnée (insensible à la casse pour les fichiers). */
    public record Columns(
            @DefaultValue("CNE") String cne,
            @DefaultValue("NOM") String nom,
            @DefaultValue("PRENOM") String prenom,
            @DefaultValue("DATE_NAISSANCE") String dateNaissance,
            @DefaultValue("LIEU_NAISSANCE") String lieuNaissance,
            @DefaultValue("FILIERE") String filiere,
            @DefaultValue("NIVEAU") String niveau,
            @DefaultValue("ANNEE") String annee,
            @DefaultValue("SEMESTRE") String semestre,
            @DefaultValue("CODE_MODULE") String codeModule,
            @DefaultValue("MODULE") String module,
            @DefaultValue("NOTE") String note,
            @DefaultValue("CREDITS") String credits,
            @DefaultValue("RESULTAT") String resultat) {

        /** Donnée logique → nom de colonne, dans l'ordre. */
        public Map<Field, String> byField() {
            Map<Field, String> map = new LinkedHashMap<>();
            map.put(Field.CNE, cne);
            map.put(Field.NOM, nom);
            map.put(Field.PRENOM, prenom);
            map.put(Field.DATE_NAISSANCE, dateNaissance);
            map.put(Field.LIEU_NAISSANCE, lieuNaissance);
            map.put(Field.FILIERE, filiere);
            map.put(Field.NIVEAU, niveau);
            map.put(Field.ANNEE, annee);
            map.put(Field.SEMESTRE, semestre);
            map.put(Field.CODE_MODULE, codeModule);
            map.put(Field.MODULE, module);
            map.put(Field.NOTE, note);
            map.put(Field.CREDITS, credits);
            map.put(Field.RESULTAT, resultat);
            return map;
        }
    }

    /**
     * Vue Oracle d'Apogée, en lecture seule. Désactivée par défaut.
     *
     * @param name       nom de la vue, éventuellement préfixé du schéma (ex. APOGEE.V_ESIGN_NOTES)
     * @param yearFormat format de l'année dans la vue : FULL (« 2025-2026 ») ou START (« 2025 », comme COD_ANU)
     */
    public record View(
            @DefaultValue("false") boolean enabled,
            String url,
            String username,
            String password,
            @DefaultValue("V_ESIGN_NOTES") String name,
            @DefaultValue("FULL") YearFormat yearFormat) {
    }

    public enum YearFormat { FULL, START }

    /** Données attendues d'Apogée. */
    public enum Field {
        CNE, NOM, PRENOM, DATE_NAISSANCE, LIEU_NAISSANCE, FILIERE, NIVEAU, ANNEE, SEMESTRE,
        CODE_MODULE, MODULE, NOTE, CREDITS, RESULTAT
    }

    /** Refuse un nom qui ne serait pas un identifiant SQL simple (protection contre l'injection SQL). */
    public static String checkIdentifier(String value, String what) {
        String[] parts = value.split("\\.", -1);
        if (parts.length > 2) {
            throw new IllegalStateException(what + " invalide : " + value);
        }
        for (String part : parts) {
            if (!SQL_IDENTIFIER.matcher(part).matches()) {
                throw new IllegalStateException(what + " invalide : " + value);
            }
        }
        return value;
    }
}
