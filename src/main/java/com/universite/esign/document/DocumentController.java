package com.universite.esign.document;

import java.util.UUID;

import com.universite.esign.common.NotFoundException;
import com.universite.esign.config.CallerContext;
import com.universite.esign.document.dto.CreateDocumentRequest;
import com.universite.esign.document.dto.DocumentResponse;
import com.universite.esign.document.dto.RevokeRequest;
import com.universite.esign.identity.Agent;
import com.universite.esign.identity.AgentResolver;
import com.universite.esign.workflow.WorkflowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/documents")
@Validated
@Tag(name = "Documents", description = "Génération et signature des attestations et relevés de notes")
class DocumentController {

    private final DocumentService service;
    private final WorkflowService workflow;
    private final AgentResolver agents;

    private static final String ATTESTATION_EXAMPLE = """
            {
              "type": "ATTESTATION_SCOLARITE",
              "student": {
                "cne": "R130456789",
                "nom": "El Amrani",
                "prenom": "Yasmine",
                "dateNaissance": "2003-05-14",
                "lieuNaissance": "Fès",
                "filiere": "Sciences Mathématiques et Informatique",
                "niveau": "Licence 3"
              },
              "academicYear": "2025-2026",
              "issuedBy": { "id": "agent.apogee", "name": "Karim Bennani" }
            }""";

    private static final String RELEVE_EXAMPLE = """
            {
              "type": "RELEVE_NOTES",
              "student": {
                "cne": "R130456789",
                "nom": "El Amrani",
                "prenom": "Yasmine",
                "filiere": "Sciences Mathématiques et Informatique",
                "niveau": "Licence 3"
              },
              "academicYear": "2025-2026",
              "semester": "S5",
              "grades": [
                { "code": "M51", "intitule": "Réseaux informatiques", "note": 14.5, "credits": 6 },
                { "code": "M52", "intitule": "Bases de données avancées", "note": 9.25, "credits": 6 },
                { "code": "M53", "intitule": "Génie logiciel", "note": 16, "credits": 4 }
              ],
              "purpose": "ETRANGER",
              "issuedBy": { "id": "agent.apogee", "name": "Karim Bennani" }
            }""";

    DocumentController(DocumentService service, WorkflowService workflow, AgentResolver agents) {
        this.service = service;
        this.workflow = workflow;
        this.agents = agents;
    }

    private DocumentResponse response(Document doc) {
        return DocumentResponse.of(doc, workflow.approvals(doc.getId()),
                service.verificationUrl(doc.getVerificationCode()));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Générer et signer un document",
            description = "Retourne 201 à la création, 200 si la même requête a déjà été traitée avec cette "
                    + "Idempotency-Key, 409 si la clé a servi pour une requête différente. "
                    + "Le document est signé immédiatement (statut SIGNED), sauf si le circuit paramétré pour "
                    + "ce type prévoit des approbations (statut PENDING_APPROVAL). "
                    + "Avec un jeton applicatif, issuedBy (agent qui établit le document) est obligatoire.")
    @ApiResponse(responseCode = "201", description = "Document généré et signé")
    @ApiResponse(responseCode = "200", description = "Requête déjà traitée (même Idempotency-Key)")
    @ApiResponse(responseCode = "400", description = "Requête invalide : la liste « errors » détaille chaque champ",
            content = @Content(mediaType = "application/problem+json"))
    @ApiResponse(responseCode = "401", description = "Jeton absent ou invalide", content = @Content)
    @ApiResponse(responseCode = "403", description = "Scope documents:write manquant", content = @Content)
    @ApiResponse(responseCode = "409", description = "Idempotency-Key déjà utilisée pour une autre requête",
            content = @Content(mediaType = "application/problem+json"))
    ResponseEntity<DocumentResponse> create(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(examples = {
                    @ExampleObject(name = "Attestation de scolarité", value = ATTESTATION_EXAMPLE),
                    @ExampleObject(name = "Relevé de notes", value = RELEVE_EXAMPLE)}))
            @Valid @RequestBody CreateDocumentRequest request,
            @Parameter(description = "Clé unique côté client pour rejouer une requête sans doublon")
            @RequestHeader(name = "Idempotency-Key", required = false) @Size(min = 8, max = 100) String idempotencyKey,
            @AuthenticationPrincipal Jwt jwt) {
        Agent issuer = agents.issuer(jwt, request.issuedBy());
        DocumentService.CreationResult result =
                service.create(request, issuer, CallerContext.clientId(jwt), idempotencyKey);
        Document doc = result.document();
        DocumentResponse body = response(doc);
        if (!result.created()) {
            return ResponseEntity.ok(body);
        }
        return ResponseEntity.created(ServletUriComponentsBuilder.fromCurrentRequest()
                        .path("/{id}").buildAndExpand(doc.getId()).toUri())
                .body(body);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter un document")
    DocumentResponse get(@PathVariable UUID id, Authentication auth, @AuthenticationPrincipal Jwt jwt) {
        return response(owned(id, auth, jwt));
    }

    @GetMapping(value = "/{id}/download", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Télécharger le PDF signé")
    ResponseEntity<byte[]> download(@PathVariable UUID id, Authentication auth, @AuthenticationPrincipal Jwt jwt) {
        Document doc = owned(id, auth, jwt);
        String filename = doc.getType().name().toLowerCase() + "-" + doc.getVerificationCode() + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(service.content(doc));
    }

    @PostMapping("/{id}/revoke")
    @Operation(summary = "Révoquer un document",
            description = "Le document reste cryptographiquement signé, mais la vérification en ligne "
                    + "indiquera qu'il n'est plus valable.")
    DocumentResponse revoke(@PathVariable UUID id, @Valid @RequestBody RevokeRequest request,
                            Authentication auth, @AuthenticationPrincipal Jwt jwt) {
        owned(id, auth, jwt);
        Agent agent = agents.issuer(jwt, request.by());
        Document doc = service.revoke(id, request.reason(), agent.auditLabel(CallerContext.clientId(jwt)));
        return response(doc);
    }

    /** Une application ne voit que les documents qu'elle a créés, sauf avec le scope documents:admin. */
    private Document owned(UUID id, Authentication auth, Jwt jwt) {
        Document doc = service.get(id);
        if (!CallerContext.isAdmin(auth) && !doc.getClientId().equals(CallerContext.clientId(jwt))) {
            // 404 plutôt que 403 : ne pas révéler l'existence du document
            throw new NotFoundException("Document introuvable : " + id);
        }
        return doc;
    }
}
