package com.universite.esign.apogee;

import java.util.List;

import com.universite.esign.apogee.ApogeeAssembler.Assembled;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.FeatureDisabledException;
import com.universite.esign.common.NotFoundException;
import com.universite.esign.document.DocumentService;
import com.universite.esign.document.DocumentType;
import com.universite.esign.document.dto.IssuedBy;
import com.universite.esign.identity.Agent;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/** Établit un document pour un étudiant à partir de la vue Oracle d'Apogée (sans ressaisie). */
@Service
public class ApogeeDocumentService {

    private final ObjectProvider<ApogeeViewClient> view;
    private final ApogeeAssembler assembler;
    private final DocumentService documents;

    ApogeeDocumentService(ObjectProvider<ApogeeViewClient> view, ApogeeAssembler assembler, DocumentService documents) {
        this.view = view;
        this.assembler = assembler;
        this.documents = documents;
    }

    public boolean viewEnabled() {
        return view.getIfAvailable() != null;
    }

    public DocumentService.CreationResult create(DocumentType type, String cne, String academicYear, String semester,
                                                 String purpose, Agent issuer, String clientId, String idempotencyKey) {
        ApogeeViewClient client = view.getIfAvailable();
        if (client == null) {
            throw new FeatureDisabledException("La vue Oracle Apogée n'est pas activée (esign.apogee.view.enabled)");
        }
        boolean transcript = type == DocumentType.RELEVE_NOTES;
        if (transcript && (semester == null || semester.isBlank())) {
            throw new BadRequestException("Le semestre est obligatoire pour un relevé de notes");
        }
        List<ApogeeRow> rows = client.find(academicYear, transcript ? semester : null, null, cne);
        if (rows.isEmpty()) {
            throw new NotFoundException("Aucune donnée Apogée pour " + cne + " / " + academicYear
                    + (transcript ? " / " + semester : ""));
        }
        List<Assembled> assembled = assembler.assemble(type, rows, purpose, new IssuedBy(issuer.id(), issuer.name()));
        // Pour une attestation, les lignes (modules) d'un même étudiant forment un seul document
        Assembled doc = assembled.getFirst();
        if (!doc.valid()) {
            throw new BadRequestException("Données Apogée incomplètes : " + String.join(" ; ", doc.errors()));
        }
        return documents.create(doc.request(), issuer, clientId, idempotencyKey);
    }
}
