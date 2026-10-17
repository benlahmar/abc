package com.universite.esign.student;

import java.util.List;

import com.universite.esign.apogee.ApogeeDocumentService;
import com.universite.esign.audit.AuditService;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.document.DocumentType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paramétrage de la demande en ligne, par type de document. */
@Service
public class StudentAccessService {

    private final StudentAccessSettingRepository settings;
    private final ApogeeDocumentService apogee;
    private final AuditService audit;

    StudentAccessService(StudentAccessSettingRepository settings, ApogeeDocumentService apogee, AuditService audit) {
        this.settings = settings;
        this.apogee = apogee;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<StudentAccessSetting> all() {
        return settings.findAll().stream()
                .sorted((a, b) -> a.getDocumentType().compareTo(b.getDocumentType())).toList();
    }

    @Transactional(readOnly = true)
    public StudentAccessSetting get(DocumentType type) {
        return settings.findById(type).orElseGet(() -> new StudentAccessSetting(type, StudentAccessMode.DISABLED, 0));
    }

    @Transactional
    public StudentAccessSetting update(DocumentType type, StudentAccessMode mode, int dailyLimit, String actor) {
        if (mode == StudentAccessMode.AUTO && !apogee.viewEnabled()) {
            throw new BadRequestException("Le mode AUTO nécessite la vue Oracle Apogée (esign.apogee.view.enabled)");
        }
        if (mode == StudentAccessMode.REGISTRY && type != DocumentType.ATTESTATION_SCOLARITE) {
            throw new BadRequestException("Le mode REGISTRY (registre des inscrits) est réservé aux attestations de "
                    + "scolarité : les notes doivent venir d'Apogée");
        }
        StudentAccessSetting setting = settings.findById(type)
                .orElseGet(() -> new StudentAccessSetting(type, mode, dailyLimit));
        setting.update(mode, dailyLimit);
        settings.save(setting);
        audit.record("STUDENT_ACCESS_UPDATED", null, actor, type + " : " + mode + ", " + dailyLimit + " demande(s)/jour");
        return setting;
    }
}
