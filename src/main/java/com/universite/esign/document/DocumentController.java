package com.universite.esign.document;

import java.util.UUID;

import com.universite.esign.common.NotFoundException;
import com.universite.esign.config.CallerContext;
import com.universite.esign.document.dto.CreateDocumentRequest;
import com.universite.esign.document.dto.DocumentResponse;
import com.universite.esign.document.dto.RevokeRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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

    DocumentController(DocumentService service) {
        this.service = service;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Générer et signer un document",
            description = "Retourne 201 à la création, 200 si la même requête a déjà été traitée avec cette "
                    + "Idempotency-Key, 409 si la clé a servi pour une requête différente.")
    ResponseEntity<DocumentResponse> create(
            @Valid @RequestBody CreateDocumentRequest request,
            @Parameter(description = "Clé unique côté client pour rejouer une requête sans doublon")
            @RequestHeader(name = "Idempotency-Key", required = false) @Size(min = 8, max = 100) String idempotencyKey,
            @AuthenticationPrincipal Jwt jwt) {
        DocumentService.CreationResult result = service.create(request, CallerContext.clientId(jwt), idempotencyKey);
        Document doc = result.document();
        DocumentResponse body = DocumentResponse.of(doc, service.verificationUrl(doc.getVerificationCode()));
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
        Document doc = owned(id, auth, jwt);
        return DocumentResponse.of(doc, service.verificationUrl(doc.getVerificationCode()));
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
        Document doc = service.revoke(id, request.reason(), CallerContext.clientId(jwt));
        return DocumentResponse.of(doc, service.verificationUrl(doc.getVerificationCode()));
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
