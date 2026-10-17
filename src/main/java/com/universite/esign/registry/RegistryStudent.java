package com.universite.esign.registry;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Un étudiant inscrit pour une année, tel qu'il figure dans la dernière liste importée de sa filière. */
@Entity
@Table(name = "registry_students")
public class RegistryStudent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "academic_year", nullable = false, length = 9)
    private String academicYear;

    @Column(nullable = false, length = 32)
    private String cne;

    @Column(nullable = false, length = 100)
    private String nom;

    @Column(nullable = false, length = 100)
    private String prenom;

    @Column(name = "date_naissance")
    private LocalDate dateNaissance;

    @Column(name = "lieu_naissance", length = 100)
    private String lieuNaissance;

    @Column(nullable = false, length = 150)
    private String filiere;

    @Column(nullable = false, length = 100)
    private String niveau;

    @Column(name = "import_id", nullable = false)
    private UUID importId;

    @Column(name = "blocked_reason", length = 500)
    private String blockedReason;

    @Column(name = "blocked_by", length = 200)
    private String blockedBy;

    @Column(name = "blocked_at")
    private Instant blockedAt;

    protected RegistryStudent() {
    }

    RegistryStudent(String academicYear, Entry entry, UUID importId) {
        this.academicYear = academicYear;
        this.cne = entry.cne();
        apply(entry, importId);
    }

    /** Données de l'étudiant lues dans le fichier importé. */
    public record Entry(int line, String cne, String nom, String prenom, LocalDate dateNaissance,
                        String lieuNaissance, String filiere, String niveau) {
    }

    /** Met à jour l'étudiant avec la nouvelle liste ; un blocage éventuel est conservé. */
    void apply(Entry entry, UUID importId) {
        this.nom = entry.nom();
        this.prenom = entry.prenom();
        this.dateNaissance = entry.dateNaissance();
        this.lieuNaissance = entry.lieuNaissance();
        this.filiere = entry.filiere();
        this.niveau = entry.niveau();
        this.importId = importId;
    }

    /** Ce qui change entre la liste en vigueur et la nouvelle, en clair (vide : rien ne change). */
    String differences(Entry e) {
        StringBuilder s = new StringBuilder();
        if (!filiere.equals(e.filiere())) s.append("filière ").append(filiere).append(" → ").append(e.filiere()).append(" ; ");
        if (!niveau.equals(e.niveau())) s.append("niveau ").append(niveau).append(" → ").append(e.niveau()).append(" ; ");
        if (!nom.equals(e.nom()) || !prenom.equals(e.prenom())) {
            s.append("nom ").append(prenom).append(' ').append(nom).append(" → ").append(e.prenom()).append(' ').append(e.nom()).append(" ; ");
        }
        if (!Objects.equals(dateNaissance, e.dateNaissance())) s.append("date de naissance ; ");
        if (!Objects.equals(lieuNaissance, e.lieuNaissance())) s.append("lieu de naissance ; ");
        return s.isEmpty() ? "" : s.substring(0, s.length() - 3);
    }

    void block(String reason, String by) {
        this.blockedReason = reason;
        this.blockedBy = by;
        this.blockedAt = Instant.now();
    }

    void unblock() {
        this.blockedReason = null;
        this.blockedBy = null;
        this.blockedAt = null;
    }

    public boolean isBlocked() { return blockedAt != null; }
    public Long getId() { return id; }
    public String getAcademicYear() { return academicYear; }
    public String getCne() { return cne; }
    public String getNom() { return nom; }
    public String getPrenom() { return prenom; }
    public LocalDate getDateNaissance() { return dateNaissance; }
    public String getLieuNaissance() { return lieuNaissance; }
    public String getFiliere() { return filiere; }
    public String getNiveau() { return niveau; }
    public UUID getImportId() { return importId; }
    public String getBlockedReason() { return blockedReason; }
    public String getBlockedBy() { return blockedBy; }
    public Instant getBlockedAt() { return blockedAt; }
}
