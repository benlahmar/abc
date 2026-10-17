package com.universite.esign.registry;

import java.time.Instant;
import java.util.UUID;

import com.universite.esign.identity.Agent;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Import d'une liste d'inscrits pour une filière et une année : elle remplace la liste précédente. */
@Entity
@Table(name = "registry_imports")
public class RegistryImport {

    @Id
    private UUID id;

    @Column(name = "academic_year", nullable = false, length = 9)
    private String academicYear;

    @Column(nullable = false, length = 150)
    private String filiere;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "student_count", nullable = false)
    private int studentCount;

    @Column(nullable = false)
    private int added;

    @Column(nullable = false)
    private int removed;

    @Column(nullable = false)
    private int changed;

    @Column(name = "imported_by_id", nullable = false, length = 100)
    private String importedById;

    @Column(name = "imported_by_name", nullable = false, length = 200)
    private String importedByName;

    @Column(name = "imported_at", nullable = false)
    private Instant importedAt;

    protected RegistryImport() {
    }

    RegistryImport(String academicYear, String filiere, String fileName, int studentCount, int added, int removed,
                   int changed, Agent by) {
        this.id = UUID.randomUUID();
        this.academicYear = academicYear;
        this.filiere = filiere;
        this.fileName = fileName;
        this.studentCount = studentCount;
        this.added = added;
        this.removed = removed;
        this.changed = changed;
        this.importedById = by.id();
        this.importedByName = by.name();
        this.importedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getAcademicYear() { return academicYear; }
    public String getFiliere() { return filiere; }
    public String getFileName() { return fileName; }
    public int getStudentCount() { return studentCount; }
    public int getAdded() { return added; }
    public int getRemoved() { return removed; }
    public int getChanged() { return changed; }
    public String getImportedById() { return importedById; }
    public String getImportedByName() { return importedByName; }
    public Instant getImportedAt() { return importedAt; }
}
