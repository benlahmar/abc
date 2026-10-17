package com.universite.esign.student;

import com.universite.esign.document.DocumentType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "student_access_settings")
public class StudentAccessSetting {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", length = 40)
    private DocumentType documentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudentAccessMode mode;

    @Column(name = "daily_limit", nullable = false)
    private int dailyLimit;

    protected StudentAccessSetting() {
    }

    StudentAccessSetting(DocumentType documentType, StudentAccessMode mode, int dailyLimit) {
        this.documentType = documentType;
        this.mode = mode;
        this.dailyLimit = dailyLimit;
    }

    void update(StudentAccessMode mode, int dailyLimit) {
        this.mode = mode;
        this.dailyLimit = dailyLimit;
    }

    public DocumentType getDocumentType() { return documentType; }
    public StudentAccessMode getMode() { return mode; }
    public int getDailyLimit() { return dailyLimit; }
}
