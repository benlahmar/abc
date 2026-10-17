package com.universite.esign.registry;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import com.universite.esign.apogee.ApogeeAssembler;
import com.universite.esign.apogee.ApogeeFileParser;
import com.universite.esign.apogee.ApogeeProperties.Field;
import com.universite.esign.apogee.ApogeeRow;
import com.universite.esign.audit.AuditService;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.NotFoundException;
import com.universite.esign.config.EsignProperties;
import com.universite.esign.identity.Agent;
import com.universite.esign.registry.RegistryStudent.Entry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Registre des inscrits. Chaque import remplace, pour l'année choisie, la liste des filières présentes dans
 * le fichier : un étudiant absent de la nouvelle liste n'obtient plus d'attestation immédiate.
 */
@Service
public class RegistryService {

    /** Taille maximale des listes détaillées dans un rapport (les effectifs restent exacts). */
    static final int DETAIL_LIMIT = 300;

    public record LineProblem(int line, String cne, List<String> errors) {
    }

    /** Étudiant cité dans un rapport ; detail : ce qui change, ou d'où il vient / où il va. */
    public record RegistryPerson(String cne, String nom, String prenom, String niveau, String detail) {
    }

    public record RegistryFiliereDiff(String filiere, int before, int after, int addedCount, int removedCount,
                              int changedCount, List<RegistryPerson> added, List<RegistryPerson> removed, List<RegistryPerson> changed) {
    }

    /** Résultat d'une vérification (applied = false) ou d'un import (applied = true). */
    public record RegistryReport(String academicYear, int rows, int students, List<LineProblem> problems,
                         List<RegistryFiliereDiff> filieres, boolean applied) {
    }

    public record RegistryFiliere(String filiere, long students, long blocked, RegistryImport lastImport) {
    }

    private final RegistryStudentRepository students;
    private final RegistryImportRepository imports;
    private final ApogeeFileParser parser;
    private final AuditService audit;
    private final EsignProperties properties;

    RegistryService(RegistryStudentRepository students, RegistryImportRepository imports, ApogeeFileParser parser,
                    AuditService audit, EsignProperties properties) {
        this.students = students;
        this.imports = imports;
        this.parser = parser;
        this.audit = audit;
        this.properties = properties;
    }

    /** Année universitaire en cours : elle commence en septembre. */
    public String currentAcademicYear() {
        LocalDate today = LocalDate.now(properties.institution().zone());
        int start = today.getMonthValue() >= 9 ? today.getYear() : today.getYear() - 1;
        return start + "-" + (start + 1);
    }

    // ---------------------------------------------------------------- import

    /** Compare le fichier à la liste en vigueur, sans rien modifier. */
    @Transactional(readOnly = true)
    public RegistryReport check(String academicYear, String fileName, byte[] content) {
        Parsed parsed = parse(academicYear, fileName, content);
        return report(academicYear, parsed, false);
    }

    /** Remplace la liste de chaque filière présente dans le fichier. Refusé si une ligne est en erreur. */
    @Transactional
    public RegistryReport apply(String academicYear, String fileName, byte[] content, Agent agent) {
        Parsed parsed = parse(academicYear, fileName, content);
        if (!parsed.problems.isEmpty()) {
            throw new BadRequestException(parsed.problems.size() + " ligne(s) en erreur : corrigez le fichier avant "
                    + "de l'importer (une liste incomplète retirerait des étudiants du registre)");
        }
        RegistryReport report = report(academicYear, parsed, true);
        Map<String, RegistryStudent> existing = byCne(academicYear);
        Set<String> inFile = parsed.entries.stream().map(Entry::cne).collect(Collectors.toSet());

        for (RegistryFiliereDiff diff : report.filieres()) {
            RegistryImport imp = imports.save(new RegistryImport(academicYear, diff.filiere(), fileName, diff.after(),
                    diff.addedCount(), diff.removedCount(), diff.changedCount(), agent));
            for (Entry e : parsed.entries) {
                if (!e.filiere().equals(diff.filiere())) {
                    continue;
                }
                RegistryStudent s = existing.get(e.cne());
                if (s == null) {
                    students.save(new RegistryStudent(academicYear, e, imp.getId()));
                } else {
                    s.apply(e, imp.getId());
                }
            }
            existing.values().stream()
                    .filter(s -> s.getFiliere().equals(diff.filiere()) && !inFile.contains(s.getCne()))
                    .forEach(students::delete);
            audit.record("REGISTRY_IMPORTED", null, agent.auditLabel("back-office"),
                    academicYear + " " + diff.filiere() + " : " + diff.after() + " inscrit(s), +" + diff.addedCount()
                            + " -" + diff.removedCount() + " ~" + diff.changedCount() + " (" + fileName + ")");
        }
        return report;
    }

    private record Parsed(int rows, List<Entry> entries, List<LineProblem> problems) {
    }

    private Parsed parse(String academicYear, String fileName, byte[] content) {
        List<ApogeeRow> rows = parser.parse(fileName, content);
        List<Entry> entries = new ArrayList<>();
        List<LineProblem> problems = new ArrayList<>();
        Map<String, Integer> seen = new HashMap<>();
        for (ApogeeRow row : rows) {
            List<String> errors = new ArrayList<>();
            String cne = row.get(Field.CNE) == null ? null : row.get(Field.CNE).strip().toUpperCase(Locale.ROOT);
            require(row, Field.CNE, "CNE", errors);
            require(row, Field.NOM, "nom", errors);
            require(row, Field.PRENOM, "prénom", errors);
            require(row, Field.FILIERE, "filière", errors);
            require(row, Field.NIVEAU, "niveau", errors);
            LocalDate birth = null;
            if (row.get(Field.DATE_NAISSANCE) != null) {
                birth = ApogeeAssembler.parseDate(row.get(Field.DATE_NAISSANCE));
                if (birth == null) {
                    errors.add("date de naissance illisible « " + row.get(Field.DATE_NAISSANCE) + " »");
                }
            }
            String year = ApogeeAssembler.academicYear(row.get(Field.ANNEE));
            if (year != null && !year.equals(academicYear)) {
                errors.add("année " + year + " différente de l'année importée (" + academicYear + ")");
            }
            if (cne != null) {
                Integer first = seen.putIfAbsent(cne, row.line());
                if (first != null) {
                    errors.add("CNE déjà présent ligne " + first);
                }
            }
            if (!errors.isEmpty()) {
                problems.add(new LineProblem(row.line(), cne, errors));
                continue;
            }
            entries.add(new Entry(row.line(), cne, row.get(Field.NOM).strip(), row.get(Field.PRENOM).strip(), birth,
                    row.get(Field.LIEU_NAISSANCE), row.get(Field.FILIERE).strip(), row.get(Field.NIVEAU).strip()));
        }
        if (rows.isEmpty()) {
            throw new BadRequestException("Le fichier ne contient aucun étudiant");
        }
        return new Parsed(rows.size(), entries, problems);
    }

    private static void require(ApogeeRow row, Field field, String label, List<String> errors) {
        if (row.get(field) == null || row.get(field).isBlank()) {
            errors.add(label + " manquant");
        }
    }

    private RegistryReport report(String academicYear, Parsed parsed, boolean applied) {
        Map<String, RegistryStudent> existing = byCne(academicYear);
        Map<String, Entry> inFile = parsed.entries.stream()
                .collect(Collectors.toMap(Entry::cne, e -> e, (a, b) -> a, LinkedHashMap::new));
        Map<String, List<Entry>> byFiliere = parsed.entries.stream()
                .collect(Collectors.groupingBy(Entry::filiere, LinkedHashMap::new, Collectors.toList()));

        List<RegistryFiliereDiff> diffs = new ArrayList<>();
        byFiliere.forEach((filiere, entries) -> {
            List<RegistryPerson> added = new ArrayList<>();
            List<RegistryPerson> changed = new ArrayList<>();
            List<RegistryPerson> removed = new ArrayList<>();
            for (Entry e : entries) {
                RegistryStudent s = existing.get(e.cne());
                if (s == null) {
                    added.add(person(e, null));
                } else if (!s.getFiliere().equals(filiere)) {
                    added.add(person(e, "venant de " + s.getFiliere()));
                } else {
                    String diff = s.differences(e);
                    if (!diff.isEmpty()) {
                        changed.add(person(e, diff));
                    }
                }
            }
            int before = 0;
            for (RegistryStudent s : existing.values()) {
                if (!s.getFiliere().equals(filiere)) {
                    continue;
                }
                before++;
                Entry moved = inFile.get(s.getCne());
                if (moved == null) {
                    removed.add(new RegistryPerson(s.getCne(), s.getNom(), s.getPrenom(), s.getNiveau(),
                            s.isBlocked() ? "bloqué" : null));
                } else if (!moved.filiere().equals(filiere)) {
                    removed.add(new RegistryPerson(s.getCne(), s.getNom(), s.getPrenom(), s.getNiveau(),
                            "vers " + moved.filiere()));
                }
            }
            diffs.add(new RegistryFiliereDiff(filiere, before, entries.size(), added.size(), removed.size(), changed.size(),
                    limit(added), limit(removed), limit(changed)));
        });
        return new RegistryReport(academicYear, parsed.rows, parsed.entries.size(), parsed.problems, diffs, applied);
    }

    private static RegistryPerson person(Entry e, String detail) {
        return new RegistryPerson(e.cne(), e.nom(), e.prenom(), e.niveau(), detail);
    }

    private static <T> List<T> limit(List<T> list) {
        return list.size() <= DETAIL_LIMIT ? list : List.copyOf(list.subList(0, DETAIL_LIMIT));
    }

    private Map<String, RegistryStudent> byCne(String academicYear) {
        return students.findByAcademicYear(academicYear).stream()
                .collect(Collectors.toMap(RegistryStudent::getCne, s -> s));
    }

    // ---------------------------------------------------------------- consultation

    @Transactional(readOnly = true)
    public List<RegistryFiliere> summary(String academicYear) {
        Map<String, RegistryImport> last = new HashMap<>();
        imports.findByAcademicYearOrderByImportedAtDesc(academicYear).forEach(i -> last.putIfAbsent(i.getFiliere(), i));
        return students.countsByFiliere(academicYear).stream()
                .map(r -> new RegistryFiliere((String) r[0], ((Number) r[1]).longValue(), ((Number) r[2]).longValue(),
                        last.get((String) r[0])))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RegistryImport> history(String academicYear) {
        return imports.findByAcademicYearOrderByImportedAtDesc(academicYear);
    }

    @Transactional(readOnly = true)
    public Page<RegistryStudent> search(String academicYear, String filiere, String q, boolean blockedOnly, int page,
                                        int size) {
        String like = q == null || q.isBlank() ? null
                : "%" + q.strip().toUpperCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                + "%";
        return students.search(academicYear, filiere == null || filiere.isBlank() ? null : filiere, like, blockedOnly,
                PageRequest.of(page, size));
    }

    @Transactional(readOnly = true)
    public Optional<RegistryImport> importOf(RegistryStudent s) {
        return imports.findById(s.getImportId());
    }

    /** Étudiant inscrit et non bloqué pour cette année, s'il existe. */
    @Transactional(readOnly = true)
    public Optional<RegistryStudent> find(String cne, String academicYear) {
        return students.findByAcademicYearAndCne(academicYear, cne.strip().toUpperCase(Locale.ROOT));
    }

    // ---------------------------------------------------------------- blocage, purge

    @Transactional
    public RegistryStudent block(long id, String reason, Agent agent) {
        RegistryStudent s = get(id);
        s.block(reason, agent.name());
        audit.record("REGISTRY_BLOCKED", null, agent.auditLabel("back-office"),
                s.getAcademicYear() + " CNE " + s.getCne() + " : " + reason);
        return s;
    }

    @Transactional
    public RegistryStudent unblock(long id, Agent agent) {
        RegistryStudent s = get(id);
        s.unblock();
        audit.record("REGISTRY_UNBLOCKED", null, agent.auditLabel("back-office"),
                s.getAcademicYear() + " CNE " + s.getCne());
        return s;
    }

    /** Supprime les listes d'une année close (données personnelles conservées le temps nécessaire). */
    @Transactional
    public int purge(String academicYear, String actor) {
        if (academicYear.equals(currentAcademicYear())) {
            throw new BadRequestException("L'année en cours (" + academicYear + ") ne peut pas être supprimée");
        }
        int removed = students.deleteYear(academicYear);
        imports.deleteYear(academicYear);
        audit.record("REGISTRY_PURGED", null, actor, academicYear + " : " + removed + " inscrit(s) supprimé(s)");
        return removed;
    }

    private RegistryStudent get(long id) {
        return students.findById(id).orElseThrow(() -> new NotFoundException("Étudiant introuvable dans le registre"));
    }
}
