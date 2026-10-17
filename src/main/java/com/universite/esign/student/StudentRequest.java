package com.universite.esign.student;

import java.time.Instant;
import java.util.UUID;

import com.universite.esign.document.DocumentType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/** Demande de document faite par un étudiant depuis l'ENT ou une autre application de la fac. */
@Entity
@Table(name = "student_requests")
public class StudentRequest {

    @Id
    private UUID id;

    @Column(name = "student_cne", nullable = false, length = 32)
    private String studentCne;

    @Column(name = "student_username", nullable = false, length = 100)
    private String studentUsername;

    @Column(name = "student_name", nullable = false, length = 200)
    private String studentName;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 40)
    private DocumentType documentType;

    @Column(name = "academic_year", nullable = false, length = 9)
    private String academicYear;

    @Column(length = 10)
    private String semester;

    @Column(length = 40)
    private String purpose;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudentRequestStatus status;

    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "handled_by_id", length = 100)
    private String handledById;

    @Column(name = "handled_by_name", length = 200)
    private String handledByName;

    @Column(name = "handled_at")
    private Instant handledAt;

    /** Note interne pour les agents (ex. « absent du registre des inscrits »), jamais montrée à l'étudiant. */
    @Column(name = "agent_note", length = 500)
    private String agentNote;

    @Column(length = 1000)
    private String message;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Version
    private long version;

    protected StudentRequest() {
    }

    StudentRequest(Student student, DocumentType type, String academicYear, String semester, String purpose) {
        this.id = UUID.randomUUID();
        this.studentCne = student.cne();
        this.studentUsername = student.username();
        this.studentName = student.name();
        this.documentType = type;
        this.academicYear = academicYear;
        this.semester = semester;
        this.purpose = purpose;
        this.status = StudentRequestStatus.PENDING;
        this.createdAt = Instant.now();
    }

    void fulfilled(UUID documentId, String byId, String byName) {
        requirePending();
        this.status = StudentRequestStatus.FULFILLED;
        this.documentId = documentId;
        handled(byId, byName, null);
    }

    void rejected(String byId, String byName, String reason) {
        requirePending();
        this.status = StudentRequestStatus.REJECTED;
        handled(byId, byName, reason);
    }

    void failed(String reason) {
        requirePending();
        this.status = StudentRequestStatus.FAILED;
        handled("libre-service", "Libre-service étudiant", reason);
    }

    private void handled(String byId, String byName, String message) {
        this.handledById = byId;
        this.handledByName = byName;
        this.handledAt = Instant.now();
        this.message = message == null || message.length() <= 1000 ? message : message.substring(0, 999) + "…";
    }

    private void requirePending() {
        if (status != StudentRequestStatus.PENDING) {
            throw new IllegalStateException("La demande a déjà été traitée (statut " + status + ")");
        }
    }

    public UUID getId() { return id; }
    public String getStudentCne() { return studentCne; }
    public String getStudentUsername() { return studentUsername; }
    public String getStudentName() { return studentName; }
    public DocumentType getDocumentType() { return documentType; }
    public String getAcademicYear() { return academicYear; }
    public String getSemester() { return semester; }
    public String getPurpose() { return purpose; }
    public StudentRequestStatus getStatus() { return status; }
    public UUID getDocumentId() { return documentId; }
    public String getHandledById() { return handledById; }
    public String getHandledByName() { return handledByName; }
    public Instant getHandledAt() { return handledAt; }
    public String getMessage() { return message; }
    public String getAgentNote() { return agentNote; }

    void noteForAgents(String note) {
        this.agentNote = note == null || note.length() <= 500 ? note : note.substring(0, 499) + "…";
    }
    public Instant getCreatedAt() { return createdAt; }
}
