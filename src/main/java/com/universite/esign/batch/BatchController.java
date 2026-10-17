package com.universite.esign.batch;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import com.universite.esign.apogee.ApogeeAssembler;
import com.universite.esign.apogee.ApogeeAssembler.Assembled;
import com.universite.esign.apogee.ApogeeFileParser;
import com.universite.esign.apogee.ApogeeRow;
import com.universite.esign.apogee.ApogeeViewClient;
import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.FeatureDisabledException;
import com.universite.esign.common.NotFoundException;
import com.universite.esign.common.PageResponse;
import com.universite.esign.config.CallerContext;
import com.universite.esign.document.Document;
import com.universite.esign.document.DocumentService;
import com.universite.esign.document.DocumentType;
import com.universite.esign.document.dto.IssuedBy;
import com.universite.esign.identity.Agent;
import com.universite.esign.identity.AgentResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@Validated
@RequestMapping("/api/v1/batches")
@Tag(name = "Traitements en masse", description = "Relevés ou attestations d'une promotion, depuis un export "
        + "Apogée (CSV/Excel) ou la vue Oracle")
class BatchController {

    /** Extraction depuis la vue Oracle d'Apogée. */
    record ApogeeExtraction(
            @NotNull DocumentType type,
            @NotBlank @Pattern(regexp = "\\d{4}-\\d{4}", message = "format attendu : 2025-2026") String academicYear,
            /** Obligatoire pour les relevés de notes. */
            @Size(max = 10) String semester,
            /** Optionnel : limiter à une filière (valeur telle qu'elle figure dans la vue). */
            @Size(max = 150) String filiere,
            @Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}") String purpose,
            @Valid IssuedBy issuedBy,
            /** Vrai : vérifier seulement, sans rien signer. */
            Boolean dryRun) {
    }

    private final BatchService batches;
    private final ApogeeFileParser parser;
    private final ApogeeAssembler assembler;
    private final ObjectProvider<ApogeeViewClient> view;
    private final DocumentService documents;
    private final AgentResolver agents;

    BatchController(BatchService batches, ApogeeFileParser parser, ApogeeAssembler assembler,
                    ObjectProvider<ApogeeViewClient> view, DocumentService documents, AgentResolver agents) {
        this.batches = batches;
        this.parser = parser;
        this.assembler = assembler;
        this.view = view;
        this.documents = documents;
        this.agents = agents;
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importer un export Apogée (CSV ou Excel)",
            description = "Une ligne par étudiant et par module (relevés) ou par étudiant (attestations). "
                    + "Avec dryRun=true, rien n'est signé : la réponse liste les erreurs ligne par ligne. "
                    + "Sinon le traitement démarre en arrière-plan (202) ; suivre son avancement avec GET /{id}.")
    @ApiResponse(responseCode = "200", description = "Vérification (dryRun)",
            content = @Content(schema = @Schema(implementation = DryRunReport.class)))
    @ApiResponse(responseCode = "202", description = "Traitement lancé",
            content = @Content(schema = @Schema(implementation = BatchResponse.class)))
    ResponseEntity<?> importFile(
            @RequestPart("file") MultipartFile file,
            @RequestParam DocumentType type,
            @RequestParam(required = false) @Parameter(description = "Usage, ex. ETRANGER") String purpose,
            @RequestParam(required = false) @Parameter(description = "Agent (obligatoire avec un jeton applicatif)")
            String issuedById,
            @RequestParam(required = false) String issuedByName,
            @RequestParam(defaultValue = "false") boolean dryRun,
            @AuthenticationPrincipal Jwt jwt) throws IOException {
        if (file.isEmpty()) {
            throw new BadRequestException("Fichier vide");
        }
        checkPurpose(purpose);
        IssuedBy declared = issuedById == null ? null
                : new IssuedBy(issuedById, issuedByName == null ? issuedById : issuedByName);
        Agent issuer = agents.issuer(jwt, declared);
        List<ApogeeRow> rows = parser.parse(file.getOriginalFilename(), file.getBytes());
        List<Assembled> assembled = assembler.assemble(type, rows, purpose, issuedBy(issuer));
        if (dryRun) {
            return ResponseEntity.ok(DryRunReport.of(rows.size(), assembled));
        }
        BatchJob job = batches.submit(type, BatchJob.Source.FILE,
                "Fichier " + file.getOriginalFilename() + " (" + rows.size() + " lignes)", assembled,
                CallerContext.clientId(jwt), issuer, purpose);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(BatchResponse.of(job));
    }

    @PostMapping("/apogee")
    @Operation(summary = "Produire les documents d'une promotion depuis la vue Oracle d'Apogée",
            description = "Critères : année, semestre (relevés), filière (optionnelle). dryRun=true pour vérifier "
                    + "sans signer. Nécessite esign.apogee.view.enabled=true.")
    @ApiResponse(responseCode = "200", description = "Vérification (dryRun)",
            content = @Content(schema = @Schema(implementation = DryRunReport.class)))
    @ApiResponse(responseCode = "202", description = "Traitement lancé",
            content = @Content(schema = @Schema(implementation = BatchResponse.class)))
    ResponseEntity<?> fromApogee(@Valid @RequestBody ApogeeExtraction request, @AuthenticationPrincipal Jwt jwt) {
        ApogeeViewClient client = view.getIfAvailable();
        if (client == null) {
            throw new FeatureDisabledException("La vue Oracle Apogée n'est pas activée (esign.apogee.view.enabled)");
        }
        if (request.type() == DocumentType.RELEVE_NOTES && (request.semester() == null || request.semester().isBlank())) {
            throw new BadRequestException("Le semestre est obligatoire pour des relevés de notes");
        }
        Agent issuer = agents.issuer(jwt, request.issuedBy());
        String semester = request.type() == DocumentType.RELEVE_NOTES ? request.semester() : null;
        List<ApogeeRow> rows = client.find(request.academicYear(), semester, request.filiere(), null);
        if (rows.isEmpty()) {
            throw new BadRequestException("Aucune donnée dans la vue Apogée pour ces critères");
        }
        List<Assembled> assembled = assembler.assemble(request.type(), rows, request.purpose(), issuedBy(issuer));
        if (Boolean.TRUE.equals(request.dryRun())) {
            return ResponseEntity.ok(DryRunReport.of(rows.size(), assembled));
        }
        String description = "Vue Apogée " + request.academicYear()
                + (semester == null ? "" : " " + semester)
                + (request.filiere() == null ? "" : " filière " + request.filiere());
        BatchJob job = batches.submit(request.type(), BatchJob.Source.APOGEE_VIEW, description, assembled,
                CallerContext.clientId(jwt), issuer, request.purpose());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(BatchResponse.of(job));
    }

    @GetMapping
    @Operation(summary = "Traitements récents",
            description = "Du plus récent au plus ancien. Le service de scolarité voit tous les traitements, "
                    + "une application cliente seulement les siens.")
    PageResponse<BatchResponse> list(@RequestParam(defaultValue = "0") @Min(0) int page,
                                     @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
                                     Authentication auth, @AuthenticationPrincipal Jwt jwt) {
        String clientId = CallerContext.seesAllDocuments(auth) ? null : CallerContext.clientId(jwt);
        return PageResponse.of(batches.list(clientId, page, size), BatchResponse::of);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Avancement d'un traitement")
    BatchResponse get(@PathVariable UUID id, Authentication auth, @AuthenticationPrincipal Jwt jwt) {
        return BatchResponse.of(owned(id, auth, jwt));
    }

    @GetMapping("/{id}/items")
    @Operation(summary = "Détail par document (filtrable par statut, ex. FAILED)")
    List<BatchItemView> items(@PathVariable UUID id, @RequestParam(required = false) BatchItemStatus status,
                              Authentication auth, @AuthenticationPrincipal Jwt jwt) {
        owned(id, auth, jwt);
        return batches.items(id, status).stream().map(BatchItemView::of).toList();
    }

    record BatchItemView(String key, String cne, String lines, BatchItemStatus status, UUID documentId, String error) {
        static BatchItemView of(BatchItem i) {
            return new BatchItemView(i.getItemKey(), i.getCne(), i.getSourceLines(), i.getStatus(), i.getDocumentId(),
                    i.getError());
        }
    }

    @GetMapping(value = "/{id}/report.csv", produces = "text/csv")
    @Operation(summary = "Rapport du traitement (CSV, ouvrable dans Excel)")
    ResponseEntity<StreamingResponseBody> report(@PathVariable UUID id, Authentication auth,
                                                 @AuthenticationPrincipal Jwt jwt) {
        owned(id, auth, jwt);
        List<BatchItem> list = batches.items(id, null);
        StreamingResponseBody body = out -> writeReport(list, out);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("rapport-" + id + ".csv").build().toString())
                .body(body);
    }

    @GetMapping(value = "/{id}/archive.zip", produces = "application/zip")
    @Operation(summary = "Tous les PDF signés du traitement + le rapport, dans un ZIP")
    ResponseEntity<StreamingResponseBody> archive(@PathVariable UUID id, Authentication auth,
                                                  @AuthenticationPrincipal Jwt jwt) {
        BatchJob job = owned(id, auth, jwt);
        List<BatchItem> list = batches.items(id, null);
        StreamingResponseBody body = out -> {
            ZipOutputStream zip = new ZipOutputStream(out);
            Set<String> names = new HashSet<>();
            for (BatchItem item : list) {
                if (item.getStatus() != BatchItemStatus.SIGNED) {
                    continue;
                }
                Document doc = documents.get(item.getDocumentId());
                String base = (item.getCne() == null ? "document" : item.getCne()) + "-"
                        + job.getDocumentType().name().toLowerCase()
                        + (doc.getSemester() == null ? "" : "-" + doc.getSemester());
                String name = base + ".pdf";
                for (int n = 2; !names.add(name); n++) {
                    name = base + "-" + n + ".pdf";
                }
                zip.putNextEntry(new ZipEntry(name.replaceAll("[^A-Za-z0-9._-]", "_")));
                zip.write(documents.content(doc));
                zip.closeEntry();
            }
            zip.putNextEntry(new ZipEntry("rapport.csv"));
            writeReport(list, zip);
            zip.closeEntry();
            zip.finish();
        };
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("lot-" + id + ".zip").build().toString())
                .body(body);
    }

    private void writeReport(List<BatchItem> list, OutputStream out) throws IOException {
        Writer w = new OutputStreamWriter(out, StandardCharsets.UTF_8);
        w.write('﻿'); // BOM : Excel ouvre correctement les accents
        w.write("cle;cne;lignes;statut;document_id;code_verification;erreur\r\n");
        for (BatchItem i : list) {
            String code = "";
            if (i.getDocumentId() != null) {
                code = documents.get(i.getDocumentId()).getVerificationCode();
            }
            w.write(String.join(";", csv(i.getItemKey()), csv(i.getCne()), csv(i.getSourceLines()),
                    i.getStatus().name(), i.getDocumentId() == null ? "" : i.getDocumentId().toString(), code,
                    csv(i.getError())));
            w.write("\r\n");
        }
        w.flush();
    }

    private static String csv(String value) {
        if (value == null) {
            return "";
        }
        // Neutralise les formules (=, +, -, @) pour éviter l'injection dans Excel
        String safe = value.matches("^[=+\\-@].*") ? "'" + value : value;
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }

    private BatchJob owned(UUID id, Authentication auth, Jwt jwt) {
        BatchJob job = batches.get(id);
        if (!CallerContext.seesAllDocuments(auth) && !job.getClientId().equals(CallerContext.clientId(jwt))) {
            throw new NotFoundException("Traitement introuvable : " + id);
        }
        return job;
    }

    private static void checkPurpose(String purpose) {
        if (purpose != null && !purpose.matches("[A-Z][A-Z0-9_]{0,39}")) {
            throw new BadRequestException("purpose : majuscules, chiffres et _ uniquement");
        }
    }

    private static IssuedBy issuedBy(Agent agent) {
        return new IssuedBy(agent.id(), agent.name());
    }
}
