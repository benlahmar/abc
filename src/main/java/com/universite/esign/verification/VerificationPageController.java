package com.universite.esign.verification;

import java.time.format.DateTimeFormatter;

import com.universite.esign.config.EsignProperties;
import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

/** Page HTML ouverte en scannant le QR code imprimé sur le document. */
@RestController
@Hidden
class VerificationPageController {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm");

    private final VerificationService service;
    private final EsignProperties.Institution institution;

    VerificationPageController(VerificationService service, EsignProperties properties) {
        this.service = service;
        this.institution = properties.institution();
    }

    @GetMapping(value = "/verify/{code}", produces = MediaType.TEXT_HTML_VALUE)
    String page(@PathVariable String code) {
        VerificationResult r = service.byCode(code);
        StringBuilder rows = new StringBuilder();
        if (r.document() != null) {
            VerificationResult.DocumentInfo d = r.document();
            row(rows, "Document", d.typeLabel());
            row(rows, "Étudiant(e)", d.studentName());
            row(rows, "CNE", d.studentCne());
            row(rows, "Année universitaire", d.academicYear());
            if (d.semester() != null) {
                row(rows, "Semestre", d.semester());
            }
            row(rows, "Signé le", DATE.format(d.signedAt().atZone(institution.zone())));
            row(rows, "Référence", d.verificationCode());
            if (d.revokedAt() != null) {
                row(rows, "Révoqué le", DATE.format(d.revokedAt().atZone(institution.zone())));
            }
        }
        String statusClass = r.authentic() ? "ok" : "ko";
        String icon = r.authentic() ? "&#10004;" : "&#10008;";
        return """
                <!doctype html>
                <html lang="fr"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Vérification de document</title>
                <style>
                  body{font-family:system-ui,sans-serif;background:#f4f6fa;margin:0;padding:24px 16px;color:#1b2430}
                  .card{max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:24px;
                        box-shadow:0 2px 12px rgba(0,0,0,.08)}
                  h1{font-size:1rem;margin:0 0 4px;color:#1f3a68} .sub{color:#667;margin:0 0 20px;font-size:.9rem}
                  .status{padding:14px 16px;border-radius:8px;font-weight:600;margin-bottom:20px}
                  .ok{background:#e6f6ec;color:#11683a} .ko{background:#fdeaea;color:#9b1c1c}
                  table{width:100%%;border-collapse:collapse} td{padding:8px 0;border-bottom:1px solid #eef;font-size:.92rem}
                  td:first-child{color:#667;width:45%%} .note{color:#889;font-size:.8rem;margin-top:20px}
                </style></head><body><div class="card">
                <h1>%s</h1><p class="sub">%s</p>
                <div class="status %s">%s %s</div>
                <table>%s</table>
                <p class="note">Vérifiez que les informations ci-dessus correspondent exactement au document présenté.
                Pour un contrôle complet, déposez le fichier PDF sur <code>POST /api/v1/verify</code>.</p>
                </div></body></html>
                """.formatted(esc(institution.university()), esc(institution.faculty()), statusClass, icon,
                esc(r.message()), rows);
    }

    private static void row(StringBuilder sb, String label, String value) {
        sb.append("<tr><td>").append(esc(label)).append("</td><td>").append(esc(value)).append("</td></tr>");
    }

    private static String esc(String value) {
        return value == null ? "" : HtmlUtils.htmlEscape(value);
    }
}
