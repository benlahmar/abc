package com.universite.esign.document;

import java.time.Instant;
import java.util.List;
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
import com.universite.esign.identity.Agent;
import com.universite.esign.pdf.PdfRenderer;
import com.universite.esign.signature.PadesSigningService;
import com.universite.esign.signature.SignatureRequest;
import com.universite.esign.signature.SignedPdf;
import com.universite.esign.storage.DocumentStorage;
import com.universite.esign.workflow.DocumentApproval;
import com.universite.esign.workflow.WorkflowService;
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
    private final WorkflowService workflow;
    private final EsignProperties properties;
    private final JsonMapper json;

    DocumentService(DocumentRepository documents, PdfRenderer renderer, PadesSigningService signer,
                    DocumentStorage storage, AuditService audit, WorkflowService workflow,
                    EsignProperties properties, JsonMapper json) {
        this.documents = documents;
        this.renderer = renderer;
        this.signer = signer;
        this.storage = storage;
        this.audit = audit;
        this.workflow = workflow;
        this.properties = properties;
        this.json = json;
    }

    public record CreationResult(Document document, boolean created) {
    }

    /**
     * Établit un document. Sans étape d'approbation applicable (cas par défaut), il est signé (PAdES)
     * immédiatement ; sinon il attend les approbations prévues par le circuit paramétré.
     * <p>
     * Avec une clé d'idempotence, un nouvel envoi de la même requête renvoie le document déjà créé
     * au lieu d'en délivrer un second ; une requête différente avec la même clé est refusée (409).
     */
    @Transactional
    public CreationResult create(CreateDocumentRequest request, Agent issuer, String clientId, String idempotencyKey) {
        checkBusinessRules(request);
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
                idempotencyKey, requestHash, issuer, request.purpose(), request.escalated(), Instant.now());
        PdfRenderer.RenderedPdf pdf = renderer.render(request, code, verificationUrl(code));
        String actor = issuer.auditLabel(clientId);
        String summary = request.type() + " " + request.academicYear()
                + (request.purpose() == null ? "" : " usage=" + request.purpose());

        // Le document doit exister avant ses étapes d'approbation (clé étrangère).
        documents.saveAndFlush(document);
        List<DocumentApproval> plan = workflow.start(id, request.type(), request.purpose(), request.escalated());
        if (WorkflowService.current(plan) == null) {
            audit.record("DOCUMENT_ISSUED", id, actor, summary);
            sign(document, pdf.content(), pdf.pageCount());
        } else {
            document.markPending(storage.store(id + "-non-signe", pdf.content()));
            audit.record("DOCUMENT_ISSUED", id, actor, summary + " en attente : "
                    + WorkflowService.current(plan).getName());
        }
        return new CreationResult(documents.save(document), true);
    }

    /** Signe le PDF avec le cachet de l'établissement et enregistre le document signé. */
    void sign(Document document, byte[] pdf, int pageCount) {
        EsignProperties.Institution inst = properties.institution();
        SignedPdf signed = signer.sign(pdf, new SignatureRequest(
                document.getType().label(),
                inst.faculty() + " - " + inst.university(),
                inst.city(),
                pageCount,
                PdfRenderer.SIGNATURE_BOX));
        String storageKey = storage.store(document.getId().toString(), signed.content());
        document.markSigned(Hashes.sha256Hex(signed.content()), storageKey, signed.level().name(),
                signed.signerSubject(), signed.signingTime());
        audit.record("DOCUMENT_SIGNED", document.getId(), "cachet-electronique",
                "sha256=" + document.getSha256());
    }

    /** Signe un document dont toutes les étapes d'approbation sont terminées. */
    @Transactional
    public void signApproved(Document document) {
        byte[] unsigned = storage.load(document.getUnsignedStorageKey());
        sign(document, unsigned, PdfRenderer.pageCount(unsigned));
        documents.save(document);
    }

    @Transactional(readOnly = true)
    public Document get(UUID id) {
        return documents.findById(id).orElseThrow(() -> new NotFoundException("Document introuvable : " + id));
    }

    /** Documents d'un étudiant, du plus récent au plus ancien. */
    @Transactional(readOnly = true)
    public List<Document> forStudent(String cne) {
        return documents.findByStudentCneOrderByCreatedAtDesc(cne);
    }

    public byte[] content(Document document) {
        if (document.getStorageKey() == null) {
            throw new ConflictException("Le document n'est pas signé (statut " + document.getStatus() + ")");
        }
        return storage.load(document.getStorageKey());
    }

    /** PDF non signé, consulté par les validateurs pendant le circuit d'approbation. */
    public byte[] unsignedContent(Document document) {
        return storage.load(document.getUnsignedStorageKey());
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

    /** Règles qui dépassent la validation des champs (utilisées aussi par l'import Apogée). */
    public static void checkBusinessRules(CreateDocumentRequest request) {
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
