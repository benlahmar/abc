package com.universite.esign.document;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.universite.esign.audit.AuditService;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.ConflictException;
import com.universite.esign.common.Hashes;
import com.universite.esign.common.NotFoundException;
import com.universite.esign.common.VerificationCodes;
import com.universite.esign.config.EsignProperties;
import com.universite.esign.document.dto.CreateDocumentRequest;
import com.universite.esign.pdf.PdfRenderer;
import com.universite.esign.signature.PadesSigningService;
import com.universite.esign.signature.SignatureRequest;
import com.universite.esign.signature.SignedPdf;
import com.universite.esign.storage.DocumentStorage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class DocumentService {

    private final DocumentRepository documents;
    private final PdfRenderer renderer;
    private final PadesSigningService signer;
    private final DocumentStorage storage;
    private final AuditService audit;
    private final EsignProperties properties;
    private final JsonMapper json;

    DocumentService(DocumentRepository documents, PdfRenderer renderer, PadesSigningService signer,
                    DocumentStorage storage, AuditService audit, EsignProperties properties, JsonMapper json) {
        this.documents = documents;
        this.renderer = renderer;
        this.signer = signer;
        this.storage = storage;
        this.audit = audit;
        this.properties = properties;
        this.json = json;
    }

    public record CreationResult(Document document, boolean created) {
    }

    /**
     * Génère, signe (PAdES) et enregistre un document.
     * <p>
     * Avec une clé d'idempotence, un nouvel envoi de la même requête renvoie le document déjà créé
     * au lieu d'en délivrer un second ; une requête différente avec la même clé est refusée (409).
     */
    @Transactional
    public CreationResult create(CreateDocumentRequest request, String clientId, String idempotencyKey) {
        validateBusinessRules(request);
        String requestHash = Hashes.sha256Hex(json.writeValueAsBytes(request));

        if (idempotencyKey != null) {
            Optional<Document> existing = documents.findByClientIdAndIdempotencyKey(clientId, idempotencyKey);
            if (existing.isPresent()) {
                if (!existing.get().getRequestHash().equals(requestHash)) {
                    throw new ConflictException("Idempotency-Key déjà utilisée pour une requête différente");
                }
                return new CreationResult(existing.get(), false);
            }
        }

        UUID id = UUID.randomUUID();
        String code = VerificationCodes.generate();
        Document document = new Document(id, code, request.type(), request.student().cne(),
                request.student().fullName(), request.academicYear(), request.semester(), clientId,
                idempotencyKey, requestHash, Instant.now());

        PdfRenderer.RenderedPdf pdf = renderer.render(request, code, verificationUrl(code));
        EsignProperties.Institution inst = properties.institution();
        SignedPdf signed = signer.sign(pdf.content(), new SignatureRequest(
                request.type().label(),
                inst.faculty() + " - " + inst.university(),
                inst.city(),
                pdf.pageCount(),
                PdfRenderer.SIGNATURE_BOX));

        String storageKey = storage.store(id.toString(), signed.content());
        document.markSigned(Hashes.sha256Hex(signed.content()), storageKey, signed.level().name(),
                signed.signerSubject(), signed.signingTime());
        documents.save(document);
        audit.record("DOCUMENT_SIGNED", id, clientId,
                request.type() + " " + request.academicYear() + " sha256=" + document.getSha256());
        return new CreationResult(document, true);
    }

    @Transactional(readOnly = true)
    public Document get(UUID id) {
        return documents.findById(id).orElseThrow(() -> new NotFoundException("Document introuvable : " + id));
    }

    public byte[] content(Document document) {
        return storage.load(document.getStorageKey());
    }

    @Transactional
    public Document revoke(UUID id, String reason, String actor) {
        Document document = get(id);
        try {
            document.revoke(reason, Instant.now());
        } catch (IllegalStateException e) {
            throw new ConflictException(e.getMessage());
        }
        audit.record("DOCUMENT_REVOKED", id, actor, reason);
        return documents.save(document);
    }

    public String verificationUrl(String code) {
        String base = properties.publicBaseUrl();
        return (base.endsWith("/") ? base.substring(0, base.length() - 1) : base) + "/verify/" + code;
    }

    private static void validateBusinessRules(CreateDocumentRequest request) {
        if (request.type() == DocumentType.RELEVE_NOTES) {
            if (request.semester() == null || request.semester().isBlank()) {
                throw new BadRequestException("Le semestre est obligatoire pour un relevé de notes");
            }
            if (request.gradesOrEmpty().isEmpty()) {
                throw new BadRequestException("Au moins une note est obligatoire pour un relevé de notes");
            }
        }
    }
}
