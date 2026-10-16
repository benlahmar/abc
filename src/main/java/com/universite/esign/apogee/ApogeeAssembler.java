package com.universite.esign.apogee;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.universite.esign.apogee.ApogeeProperties.Field;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.document.DocumentService;
import com.universite.esign.document.DocumentType;
import com.universite.esign.document.dto.CreateDocumentRequest;
import com.universite.esign.document.dto.GradeLine;
import com.universite.esign.document.dto.IssuedBy;
import com.universite.esign.document.dto.StudentInfo;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.stereotype.Component;

/**
 * Regroupe les lignes Apogée (un étudiant × un module) en demandes de documents : un relevé par
 * étudiant, année et semestre ; une attestation par étudiant et année. Chaque document garde les numéros
 * de ses lignes d'origine pour signaler précisément les erreurs.
 */
@Component
public class ApogeeAssembler {

    private static final Pattern YEAR = Pattern.compile("(\\d{4})(?:\\s*[-/]\\s*(\\d{2,4}))?");
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy"));

    private final Validator validator;

    public ApogeeAssembler(Validator validator) {
        this.validator = validator;
    }

    /**
     * Document assemblé.
     *
     * @param key     identifiant lisible, ex. « R130456789 / 2025-2026 / S5 »
     * @param lines   lignes d'origine
     * @param request la demande, ou null si elle est invalide
     * @param errors  erreurs, avec les numéros de ligne concernés
     */
    public record Assembled(String key, String cne, String lines, CreateDocumentRequest request, List<String> errors) {

        public boolean valid() {
            return errors.isEmpty();
        }
    }

    public List<Assembled> assemble(DocumentType type, List<ApogeeRow> rows, String purpose, IssuedBy issuedBy) {
        Map<String, List<ApogeeRow>> groups = new LinkedHashMap<>();
        List<Assembled> result = new ArrayList<>();
        for (ApogeeRow row : rows) {
            String cne = row.get(Field.CNE);
            if (cne == null) {
                result.add(new Assembled("ligne " + row.line(), null, String.valueOf(row.line()), null,
                        List.of("ligne " + row.line() + " : CNE manquant")));
                continue;
            }
            String year = academicYear(row.get(Field.ANNEE));
            String key = type == DocumentType.RELEVE_NOTES
                    ? cne + " / " + year + " / " + row.get(Field.SEMESTRE)
                    : cne + " / " + year;
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(row);
        }
        groups.forEach((key, group) -> result.add(build(type, key, group, purpose, issuedBy)));
        return result;
    }

    private Assembled build(DocumentType type, String key, List<ApogeeRow> group, String purpose, IssuedBy issuedBy) {
        List<String> errors = new ArrayList<>();
        ApogeeRow first = group.getFirst();
        String lines = lineRange(group);

        LocalDate birth = null;
        String rawBirth = first.get(Field.DATE_NAISSANCE);
        if (rawBirth != null) {
            birth = parseDate(rawBirth);
            if (birth == null) {
                errors.add("ligne " + first.line() + " : date de naissance illisible « " + rawBirth + " »");
            }
        }
        StudentInfo student = new StudentInfo(first.get(Field.CNE), first.get(Field.NOM), first.get(Field.PRENOM),
                birth, first.get(Field.LIEU_NAISSANCE), first.get(Field.FILIERE), first.get(Field.NIVEAU));

        List<GradeLine> grades = null;
        String semester = first.get(Field.SEMESTRE);
        if (type == DocumentType.RELEVE_NOTES) {
            grades = new ArrayList<>();
            for (ApogeeRow row : group) {
                BigDecimal note = parseDecimal(row.get(Field.NOTE));
                if (note == null) {
                    errors.add("ligne " + row.line() + " : note manquante ou illisible « "
                            + nullToEmpty(row.get(Field.NOTE)) + " » (module " + nullToEmpty(row.get(Field.CODE_MODULE)) + ")");
                    continue;
                }
                Integer credits = null;
                String rawCredits = row.get(Field.CREDITS);
                if (rawCredits != null) {
                    BigDecimal c = parseDecimal(rawCredits);
                    if (c == null || c.stripTrailingZeros().scale() > 0) {
                        errors.add("ligne " + row.line() + " : crédits illisibles « " + rawCredits + " »");
                    } else {
                        credits = c.intValueExact();
                    }
                }
                grades.add(new GradeLine(row.get(Field.CODE_MODULE), row.get(Field.MODULE), note, credits,
                        row.get(Field.RESULTAT)));
            }
        } else {
            semester = null;
        }

        CreateDocumentRequest request = new CreateDocumentRequest(type, student, academicYear(first.get(Field.ANNEE)),
                semester, grades, issuedBy, purpose, null);
        for (ConstraintViolation<CreateDocumentRequest> v : validator.validate(request)) {
            errors.add("lignes " + lines + " : " + label(v.getPropertyPath().toString()) + " " + v.getMessage());
        }
        if (errors.isEmpty()) {
            try {
                DocumentService.checkBusinessRules(request);
            } catch (BadRequestException e) {
                errors.add("lignes " + lines + " : " + e.getMessage());
            }
        }
        return new Assembled(key, student.cne(), lines, errors.isEmpty() ? request : null, List.copyOf(errors));
    }

    /** « 2025-2026 », « 2025/26 » ou « 2025 » (année de début, comme COD_ANU d'Apogée) → « 2025-2026 ». */
    public static String academicYear(String raw) {
        if (raw == null) {
            return null;
        }
        Matcher m = YEAR.matcher(raw.strip());
        if (!m.matches()) {
            return raw.strip();
        }
        int start = Integer.parseInt(m.group(1));
        return start + "-" + (start + 1);
    }

    static BigDecimal parseDecimal(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return new BigDecimal(raw.strip().replace(',', '.').replace(" ", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static LocalDate parseDate(String raw) {
        String value = raw.strip();
        // Les dates Oracle/Excel peuvent arriver avec une heure : « 2003-05-14 00:00:00 »
        if (value.length() > 10 && (value.charAt(10) == ' ' || value.charAt(10) == 'T')) {
            value = value.substring(0, 10);
        }
        for (DateTimeFormatter format : DATE_FORMATS) {
            try {
                return LocalDate.parse(value, format);
            } catch (DateTimeParseException ignored) {
                // format suivant
            }
        }
        return null;
    }

    private static String lineRange(List<ApogeeRow> group) {
        TreeSet<Integer> lines = new TreeSet<>();
        group.forEach(r -> lines.add(r.line()));
        int min = lines.first();
        int max = lines.last();
        if (min == max) {
            return String.valueOf(min);
        }
        return lines.size() == max - min + 1 ? min + "-" + max
                : String.join(",", lines.stream().map(String::valueOf).toList());
    }

    private static String label(String path) {
        return path.replace("student.", "").replaceAll("grades\\[(\\d+)]\\.", "module $1 : ");
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
