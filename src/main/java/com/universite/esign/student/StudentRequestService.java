package com.universite.esign.student;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;

import com.universite.esign.apogee.ApogeeDocumentService;
import com.universite.esign.audit.AuditService;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.ConflictException;
import com.universite.esign.common.NotFoundException;
import com.universite.esign.common.TooManyRequestsException;
import com.universite.esign.config.EsignProperties;
import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentService;
import com.universite.esign.document.DocumentType;
import com.universite.esign.document.dto.CreateDocumentRequest;
import com.universite.esign.document.dto.StudentInfo;
import com.universite.esign.identity.Agent;
import com.universite.esign.registry.RegistryService;
import com.universite.esign.registry.RegistryStudent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Demandes de documents faites par les étudiants. Selon le paramétrage du type de document, la demande
 * est produite immédiatement depuis la vue Apogée (AUTO) ou placée dans la file du service (AGENT).
 * <p>
 * Pas de transaction englobante : la demande est enregistrée, puis le document est produit dans sa propre
 * transaction ; un échec de production laisse une demande en statut FAILED, avec le motif.
 */
@Service
public class StudentRequestService {

    private static final Logger log = LoggerFactory.getLogger(StudentRequestService.class);
    static final Agent SELF_SERVICE = new Agent("libre-service", "Libre-service étudiant (données Apogée)",
            Agent.Source.SYSTEM);
    static final Agent REGISTRY_SERVICE = new Agent("registre-inscrits",
            "Libre-service étudiant (registre des inscrits)", Agent.Source.SYSTEM);

    private final StudentRequestRepository requests;
    private final StudentAccessService access;
    private final ApogeeDocumentService apogee;
    private final DocumentService documents;
    private final AuditService audit;
    private final EsignProperties properties;
    private final RegistryService registry;

    StudentRequestService(StudentRequestRepository requests, StudentAccessService access, ApogeeDocumentService apogee,
                          DocumentService documents, AuditService audit, EsignProperties properties,
                          RegistryService registry) {
        this.registry = registry;
        this.requests = requests;
        this.access = access;
        this.apogee = apogee;
        this.documents = documents;
        this.audit = audit;
        this.properties = properties;
    }

    // ---------------------------------------------------------------- côté étudiant

    public StudentRequest request(Student student, DocumentType type, String academicYear, String semester,
                                  String purpose, String clientId) {
        StudentAccessSetting setting = access.get(type);
        if (setting.getMode() == StudentAccessMode.DISABLED) {
            throw new BadRequestException("La demande en ligne n'est pas disponible pour : " + type.label());
        }
        if (type == DocumentType.RELEVE_NOTES && (semester == null || semester.isBlank())) {
            throw new BadRequestException("Le semestre est obligatoire pour un relevé de notes");
        }
        LocalDate today = LocalDate.now(properties.institution().zone());
        long todayCount = requests.countByStudentCneAndDocumentTypeAndCreatedAtAfter(student.cne(), type,
                today.atStartOfDay(properties.institution().zone()).toInstant());
        if (todayCount >= setting.getDailyLimit()) {
            throw new TooManyRequestsException("Limite de " + setting.getDailyLimit() + " demande(s) par jour atteinte "
                    + "pour : " + type.label());
        }

        StudentRequest request = requests.save(new StudentRequest(student, type, academicYear,
                type == DocumentType.RELEVE_NOTES ? semester : null, purpose));
        String actor = "etudiant " + student.username() + " (via " + clientId + ")";
        recordAudit("STUDENT_REQUEST", request, actor, type + " " + academicYear
                + (request.getSemester() == null ? "" : " " + request.getSemester()) + " mode " + setting.getMode());

        if (setting.getMode() == StudentAccessMode.AUTO) {
            try {
                DocumentService.CreationResult result = apogee.create(type, student.cne(), academicYear,
                        request.getSemester(), purpose, SELF_SERVICE, clientId, "etudiant-" + request.getId());
                return complete(request.getId(), r -> r.fulfilled(result.document().getId(), SELF_SERVICE.id(),
                        SELF_SERVICE.name()));
            } catch (RuntimeException e) {
                log.info("Demande {} : production automatique impossible : {}", request.getId(), e.getMessage());
                String reason = "Production automatique impossible : " + e.getMessage()
                        + ". Contacter le service de scolarité.";
                return complete(request.getId(), r -> r.failed(reason));
            }
        }
        if (setting.getMode() == StudentAccessMode.REGISTRY) {
            return fromRegistry(request, student, purpose, clientId);
        }
        return request;
    }

    /**
     * Attestation immédiate si l'étudiant figure, non bloqué, dans le registre de l'année demandée. Sinon la
     * demande reste dans la file du service, avec une note expliquant pourquoi (jamais refusée d'office).
     */
    private StudentRequest fromRegistry(StudentRequest request, Student student, String purpose, String clientId) {
        Optional<RegistryStudent> found = registry.find(student.cne(), request.getAcademicYear());
        if (found.isEmpty()) {
            return complete(request.getId(), r -> r.noteForAgents("Absent du registre des inscrits "
                    + request.getAcademicYear() + " : vérifier l'inscription avant d'établir l'attestation"));
        }
        RegistryStudent s = found.get();
        if (s.isBlocked()) {
            return complete(request.getId(), r -> r.noteForAgents("Bloqué dans le registre par " + s.getBlockedBy()
                    + " : " + s.getBlockedReason()));
        }
        CreateDocumentRequest data = new CreateDocumentRequest(DocumentType.ATTESTATION_SCOLARITE,
                new StudentInfo(s.getCne(), s.getNom(), s.getPrenom(), s.getDateNaissance(), s.getLieuNaissance(),
                        s.getFiliere(), s.getNiveau()),
                request.getAcademicYear(), null, null, null, purpose, null);
        try {
            DocumentService.CreationResult result = documents.create(data, REGISTRY_SERVICE, clientId,
                    "etudiant-" + request.getId());
            StudentRequest saved = complete(request.getId(), r -> r.fulfilled(result.document().getId(),
                    REGISTRY_SERVICE.id(), REGISTRY_SERVICE.name()));
            String source = registry.importOf(s).map(i -> "registre " + i.getFiliere() + " importé le "
                    + i.getImportedAt() + " par " + i.getImportedByName()).orElse("registre");
            recordAudit("STUDENT_REQUEST_FULFILLED", saved, REGISTRY_SERVICE.auditLabel(clientId),
                    "document " + result.document().getId() + " depuis le " + source);
            return saved;
        } catch (RuntimeException e) {
            log.info("Demande {} : délivrance depuis le registre impossible : {}", request.getId(), e.getMessage());
            return complete(request.getId(), r -> r.noteForAgents("Délivrance automatique impossible : "
                    + e.getMessage()));
        }
    }

    @Transactional(readOnly = true)
    public List<StudentRequest> mine(Student student) {
        return requests.findByStudentCneOrderByCreatedAtDesc(student.cne());
    }

    // ---------------------------------------------------------------- côté agents

    @Transactional(readOnly = true)
    public List<StudentRequest> pending() {
        return requests.findByStatusOrderByCreatedAtAsc(StudentRequestStatus.PENDING);
    }

    /** Demandes traitées (les 200 plus récentes) : historique consultable par les agents. */
    @Transactional(readOnly = true)
    public List<StudentRequest> handled(StudentRequestStatus status) {
        return requests.findTop200ByStatusOrderByHandledAtDesc(status);
    }

    @Transactional(readOnly = true)
    public StudentRequest get(UUID id) {
        return requests.findById(id).orElseThrow(() -> new NotFoundException("Demande introuvable : " + id));
    }

    /** L'agent établit le document à partir de la vue Apogée, sans ressaisie. */
    public StudentRequest fulfillFromApogee(UUID id, Agent agent, String clientId) {
        StudentRequest r = pendingRequest(id);
        DocumentService.CreationResult result = apogee.create(r.getDocumentType(), r.getStudentCne(),
                r.getAcademicYear(), r.getSemester(), r.getPurpose(), agent, clientId, "etudiant-" + id);
        return fulfilled(r, result.document(), agent, clientId);
    }

    /** L'agent établit le document à partir des données fournies (export, saisie). */
    public StudentRequest fulfill(UUID id, CreateDocumentRequest data, Agent agent, String clientId) {
        StudentRequest r = pendingRequest(id);
        if (data.type() != r.getDocumentType() || !data.student().cne().equalsIgnoreCase(r.getStudentCne())
                || !data.academicYear().equals(r.getAcademicYear())
                || (r.getSemester() != null && !r.getSemester().equals(data.semester()))) {
            throw new BadRequestException("Les données ne correspondent pas à la demande (type, CNE, année, semestre)");
        }
        DocumentService.CreationResult result = documents.create(data, agent, clientId, "etudiant-" + id);
        return fulfilled(r, result.document(), agent, clientId);
    }

    public StudentRequest reject(UUID id, Agent agent, String clientId, String reason) {
        StudentRequest r = pendingRequest(id);
        StudentRequest saved = complete(id, req -> req.rejected(agent.id(), agent.name(), reason));
        recordAudit("STUDENT_REQUEST_REJECTED", r, agent.auditLabel(clientId), reason);
        return saved;
    }

    private StudentRequest fulfilled(StudentRequest r, Document document, Agent agent, String clientId) {
        StudentRequest saved = complete(r.getId(), req -> req.fulfilled(document.getId(), agent.id(), agent.name()));
        recordAudit("STUDENT_REQUEST_FULFILLED", r, agent.auditLabel(clientId), "document " + document.getId());
        return saved;
    }

    private StudentRequest pendingRequest(UUID id) {
        StudentRequest r = get(id);
        if (r.getStatus() != StudentRequestStatus.PENDING) {
            throw new ConflictException("La demande a déjà été traitée (statut " + r.getStatus() + ")");
        }
        return r;
    }

    private StudentRequest complete(UUID id, Consumer<StudentRequest> change) {
        StudentRequest r = get(id);
        try {
            change.accept(r);
        } catch (IllegalStateException e) {
            throw new ConflictException(e.getMessage());
        }
        return requests.save(r);
    }

    private void recordAudit(String type, StudentRequest r, String actor, String details) {
        audit.recordInNewTransaction(type, r.getDocumentId(), actor,
                "demande " + r.getId() + " CNE " + r.getStudentCne() + " : " + details);
    }
}
