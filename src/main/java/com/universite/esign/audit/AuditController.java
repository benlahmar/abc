package com.universite.esign.audit;

import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.PageResponse;
import com.universite.esign.config.EsignProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@Validated
@RequestMapping("/api/v1/audit")
@Tag(name = "Audit")
class AuditController {

    /** Plafond de l'export CSV (les plus récents d'abord) : au-delà, affiner les critères. */
    static final int EXPORT_LIMIT = 10_000;

    private final AuditService audit;
    private final ZoneId zone;

    AuditController(AuditService audit, EsignProperties properties) {
        this.audit = audit;
        this.zone = properties.institution().zone();
    }

    /** Critères communs à la consultation et à l'export ; dates en jours de l'établissement, « au » inclus. */
    private AuditSearch criteria(List<String> type, String actor, String q, UUID documentId, LocalDate from,
                                 LocalDate to) {
        if (from != null && to != null && to.isBefore(from)) {
            throw new BadRequestException("La date de fin précède la date de début");
        }
        return new AuditSearch(type, actor, q, documentId,
                from == null ? null : from.atStartOfDay(zone).toInstant(),
                to == null ? null : to.plusDays(1).atStartOfDay(zone).toInstant());
    }

    @GetMapping("/verify")
    @Operation(summary = "Vérifier l'intégrité du journal d'audit (chaîne d'empreintes)")
    AuditService.ChainVerification verify() {
        return audit.verifyChain();
    }

    @GetMapping("/events")
    @Operation(summary = "Journal d'audit, du plus récent au plus ancien",
            description = "type (répétable) : limiter à certains événements, ex. WORKFLOW_UPDATED, "
                    + "STUDENT_ACCESS_UPDATED pour l'historique du paramétrage. actor, q (texte du détail : CNE, "
                    + "référence, motif…), documentId, from et to (dates, incluses) affinent la recherche.")
    PageResponse<AuditEvent> events(@RequestParam(required = false) List<String> type,
                                    @RequestParam(required = false) @Size(max = 100) String actor,
                                    @RequestParam(required = false) @Size(max = 100) String q,
                                    @RequestParam(required = false) UUID documentId,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                                    LocalDate from,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                                    LocalDate to,
                                    @RequestParam(defaultValue = "0") @Min(0) int page,
                                    @RequestParam(defaultValue = "50") @Min(1) @Max(200) int size) {
        return PageResponse.of(audit.search(criteria(type, actor, q, documentId, from, to), page, size), e -> e);
    }

    @GetMapping(value = "/events.csv", produces = "text/csv")
    @Operation(summary = "Exporter le journal (CSV pour Excel), mêmes critères",
            description = "Les 10 000 événements les plus récents correspondant aux critères, avec leurs empreintes.")
    ResponseEntity<StreamingResponseBody> export(@RequestParam(required = false) List<String> type,
                                                 @RequestParam(required = false) @Size(max = 100) String actor,
                                                 @RequestParam(required = false) @Size(max = 100) String q,
                                                 @RequestParam(required = false) UUID documentId,
                                                 @RequestParam(required = false)
                                                 @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                 @RequestParam(required = false)
                                                 @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        List<AuditEvent> rows = audit.search(criteria(type, actor, q, documentId, from, to), 0, EXPORT_LIMIT)
                .getContent();
        DateTimeFormatter date = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(zone);
        StreamingResponseBody body = out -> {
            Writer w = new OutputStreamWriter(out, StandardCharsets.UTF_8);
            w.write('\uFEFF'); // BOM : Excel ouvre correctement les accents
            w.write("numero;date;evenement;acteur;document_id;detail;empreinte_precedente;empreinte\r\n");
            for (AuditEvent e : rows) {
                w.write(String.join(";", String.valueOf(e.getId()), date.format(e.getCreatedAt()), e.getEventType(),
                        csv(e.getActor()), e.getDocumentId() == null ? "" : e.getDocumentId().toString(),
                        csv(e.getDetails()), e.getPreviousHash(), e.getHash()));
                w.write("\r\n");
            }
            w.flush();
        };
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("journal-audit-" + LocalDate.now(zone) + ".csv").build().toString())
                .body(body);
    }

    @GetMapping("/types")
    @Operation(summary = "Nombre d'événements par type")
    List<AuditService.TypeCount> types() {
        return audit.countByType();
    }

    /** Valeur protégée pour Excel : guillemets doublés, formules (=, +, -, @) neutralisées. */
    private static String csv(String value) {
        if (value == null) {
            return "";
        }
        String safe = value.matches("^[=+\\-@].*") ? "'" + value : value;
        return "\"" + safe.replace("\"", "\"\"").replace("\r", " ").replace("\n", " ") + "\"";
    }

    @GetMapping("/documents/{id}")
    @Operation(summary = "Historique d'un document")
    List<AuditEvent> forDocument(@PathVariable UUID id) {
        return audit.forDocument(id);
    }
}
