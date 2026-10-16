package com.universite.esign.pdf;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import com.universite.esign.config.EsignProperties;
import com.universite.esign.document.dto.CreateDocumentRequest;
import com.universite.esign.document.dto.GradeLine;
import com.universite.esign.document.dto.StudentInfo;
import com.universite.esign.signature.SignatureRequest;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Component;

/**
 * Génère le PDF (non signé) d'une attestation ou d'un relevé de notes.
 * <p>
 * Le QR code de vérification est intégré <em>avant</em> la signature : toute modification
 * ultérieure du document invaliderait la signature.
 */
@Component
public class PdfRenderer {

    private static final PDRectangle PAGE = PDRectangle.A4;
    private static final float MARGIN = 50;
    private static final float CONTENT_WIDTH = PAGE.getWidth() - 2 * MARGIN;
    /** Hauteur réservée en bas de la dernière page au QR code et à la signature visible. */
    private static final float FOOTER_HEIGHT = 170;
    private static final Color PRIMARY = new Color(0x1F, 0x3A, 0x68);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Zone de la signature visible (coordonnées DSS : origine en haut à gauche). */
    public static final SignatureRequest.Box SIGNATURE_BOX =
            new SignatureRequest.Box(345, PAGE.getHeight() - 50 - 75, 200, 75);

    private final EsignProperties.Institution institution;

    public PdfRenderer(EsignProperties properties) {
        this.institution = properties.institution();
    }

    public record RenderedPdf(byte[] content, int pageCount) {
    }

    public RenderedPdf render(CreateDocumentRequest request, String verificationCode, String verificationUrl) {
        try (PDDocument doc = new PDDocument()) {
            Writer w = new Writer(doc);
            PDDocumentInformation info = doc.getDocumentInformation();
            info.setTitle(request.type().label() + " - " + request.student().fullName());
            info.setAuthor(institution.faculty() + " - " + institution.university());
            info.setSubject(request.type().label());
            info.setProducer("esign-api");

            w.newPage();
            header(w, request, verificationCode);
            switch (request.type()) {
                case ATTESTATION_SCOLARITE -> attestation(w, request);
                case RELEVE_NOTES -> transcript(w, request);
            }
            footer(w, verificationCode, verificationUrl);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            w.close();
            doc.save(out);
            return new RenderedPdf(out.toByteArray(), doc.getNumberOfPages());
        } catch (IOException e) {
            throw new UncheckedIOException("Erreur de génération du PDF", e);
        }
    }

    private void header(Writer w, CreateDocumentRequest request, String code) throws IOException {
        w.centered(institution.university().toUpperCase(), 13, true, PRIMARY);
        w.y -= 17;
        w.centered(institution.faculty(), 11, false, PRIMARY);
        w.y -= 10;
        w.line(MARGIN, PAGE.getWidth() - MARGIN, PRIMARY);
        w.y -= 40;
        w.centered(request.type().label().toUpperCase(), 18, true, Color.BLACK);
        w.y -= 22;
        w.centered("Année universitaire " + request.academicYear(), 10, false, Color.DARK_GRAY);
        w.y -= 14;
        w.centered("Réf. " + code, 9, false, Color.GRAY);
        w.y -= 35;
    }

    private void attestation(Writer w, CreateDocumentRequest request) throws IOException {
        StudentInfo s = request.student();
        w.paragraph(institution.signatoryTitle() + " de la " + institution.faculty()
                + " atteste que l'étudiant(e) :", 11, false);
        w.y -= 12;
        studentBlock(w, s);
        w.y -= 12;
        w.paragraph("est régulièrement inscrit(e) en " + s.niveau() + ", filière " + s.filiere()
                + ", au titre de l'année universitaire " + request.academicYear() + ".", 11, false);
        w.y -= 12;
        w.paragraph("La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.",
                11, false);
        w.y -= 25;
        w.text(PAGE.getWidth() - MARGIN - 200, w.y,
                "Fait à " + institution.city() + ", le " + DATE.format(LocalDate.now(institution.zone())),
                10, false, Color.BLACK);
        w.y -= 15;
    }

    private void transcript(Writer w, CreateDocumentRequest request) throws IOException {
        studentBlock(w, request.student());
        w.labelValue("Semestre", request.semester());
        w.y -= 15;

        float[] cols = {MARGIN, MARGIN + 60, MARGIN + 330, MARGIN + 395, MARGIN + 445};
        String[] headers = {"Code", "Module", "Note /20", "Crédits", "Résultat"};
        tableHeader(w, cols, headers);
        for (GradeLine g : request.gradesOrEmpty()) {
            if (w.y < MARGIN + 30) {
                w.newPage();
                tableHeader(w, cols, headers);
            }
            String[] cells = {g.code(), w.fit(g.intitule(), 9, cols[2] - cols[1] - 8),
                    g.note().setScale(2).toPlainString(), String.valueOf(g.weight()), g.effectiveResult()};
            for (int i = 0; i < cells.length; i++) {
                w.text(cols[i] + 4, w.y, cells[i], 9, false, Color.BLACK);
            }
            w.y -= 6;
            w.line(MARGIN, PAGE.getWidth() - MARGIN, Color.LIGHT_GRAY);
            w.y -= 12;
        }
        w.y -= 10;
        BigDecimal average = request.average();
        w.text(cols[1] + 4, w.y, "Moyenne du semestre", 10, true, Color.BLACK);
        w.text(cols[2] + 4, w.y, average.toPlainString(), 10, true, Color.BLACK);
        w.text(cols[4] + 4, w.y, average.compareTo(BigDecimal.TEN) >= 0 ? "Validé" : "Non validé",
                10, true, Color.BLACK);
        w.y -= 30;
        w.text(PAGE.getWidth() - MARGIN - 200, w.y,
                "Fait à " + institution.city() + ", le " + DATE.format(LocalDate.now(institution.zone())),
                10, false, Color.BLACK);
        w.y -= 15;
    }

    private void tableHeader(Writer w, float[] cols, String[] headers) throws IOException {
        w.fillRect(MARGIN, w.y - 6, CONTENT_WIDTH, 20, new Color(0xEE, 0xF3, 0xFA));
        for (int i = 0; i < headers.length; i++) {
            w.text(cols[i] + 4, w.y, headers[i], 9, true, PRIMARY);
        }
        w.y -= 22;
    }

    private void studentBlock(Writer w, StudentInfo s) throws IOException {
        w.labelValue("Nom et prénom", s.fullName());
        w.labelValue("CNE", s.cne());
        if (s.dateNaissance() != null) {
            w.labelValue("Né(e) le", DATE.format(s.dateNaissance())
                    + (s.lieuNaissance() == null || s.lieuNaissance().isBlank() ? "" : " à " + s.lieuNaissance()));
        }
        w.labelValue("Filière", s.filiere());
        w.labelValue("Niveau", s.niveau());
    }

    private void footer(Writer w, String code, String url) throws IOException {
        if (w.y < FOOTER_HEIGHT) {
            w.newPage();
        }
        PDImageXObject qr = LosslessFactory.createFromImage(w.doc, QrCodeGenerator.generate(url, 270));
        w.stream.drawImage(qr, MARGIN, MARGIN, 90, 90);

        float x = MARGIN + 100;
        w.text(x, MARGIN + 78, "Vérifier l'authenticité de ce document :", 8, true, PRIMARY);
        w.text(x, MARGIN + 66, "scannez le QR code ou saisissez la référence", 7.5f, false, Color.DARK_GRAY);
        w.text(x, MARGIN + 54, code, 8, true, Color.BLACK);
        w.text(x, MARGIN + 42, "sur " + w.fit(url.substring(0, url.length() - code.length()), 7.5f, 185),
                7.5f, false, Color.DARK_GRAY);
        w.text(x, MARGIN + 22, "Signature électronique avancée (PAdES).", 6.5f, false, Color.GRAY);
        w.text(x, MARGIN + 13, "Toute modification invalide la signature.", 6.5f, false, Color.GRAY);

        w.text(SIGNATURE_BOX.x(), PAGE.getHeight() - SIGNATURE_BOX.y() + 8, institution.signatoryTitle(),
                9, true, Color.BLACK);
    }

    /** Petit utilitaire d'écriture séquentielle de haut en bas. */
    private static final class Writer {
        final PDDocument doc;
        final PDType0Font regular;
        final PDType0Font bold;
        PDPageContentStream stream;
        float y;

        Writer(PDDocument doc) throws IOException {
            this.doc = doc;
            this.regular = loadFont(doc, "/fonts/DejaVuSans.ttf");
            this.bold = loadFont(doc, "/fonts/DejaVuSans-Bold.ttf");
        }

        private static PDType0Font loadFont(PDDocument doc, String path) throws IOException {
            try (InputStream in = PdfRenderer.class.getResourceAsStream(path)) {
                return PDType0Font.load(doc, in);
            }
        }

        void newPage() throws IOException {
            close();
            PDPage page = new PDPage(PAGE);
            doc.addPage(page);
            stream = new PDPageContentStream(doc, page);
            y = PAGE.getHeight() - MARGIN - 10;
        }

        void close() throws IOException {
            if (stream != null) {
                stream.close();
                stream = null;
            }
        }

        void text(float x, float atY, String value, float size, boolean isBold, Color color) throws IOException {
            PDType0Font font = isBold ? bold : regular;
            stream.beginText();
            stream.setFont(font, size);
            stream.setNonStrokingColor(color);
            stream.newLineAtOffset(x, atY);
            stream.showText(sanitize(font, value));
            stream.endText();
        }

        void centered(String value, float size, boolean isBold, Color color) throws IOException {
            PDType0Font font = isBold ? bold : regular;
            String safe = sanitize(font, value);
            float width = font.getStringWidth(safe) / 1000 * size;
            text((PAGE.getWidth() - width) / 2, y, safe, size, isBold, color);
        }

        void labelValue(String label, String value) throws IOException {
            text(MARGIN + 20, y, label + " :", 10, false, Color.DARK_GRAY);
            text(MARGIN + 140, y, fit(value, 10, CONTENT_WIDTH - 160), 10, true, Color.BLACK);
            y -= 17;
        }

        void paragraph(String value, float size, boolean isBold) throws IOException {
            PDType0Font font = isBold ? bold : regular;
            for (String line : wrap(font, sanitize(font, value), size, CONTENT_WIDTH)) {
                text(MARGIN, y, line, size, isBold, Color.BLACK);
                y -= size * 1.5f;
            }
        }

        void line(float x1, float x2, Color color) throws IOException {
            stream.setStrokingColor(color);
            stream.setLineWidth(0.7f);
            stream.moveTo(x1, y);
            stream.lineTo(x2, y);
            stream.stroke();
        }

        void fillRect(float x, float atY, float width, float height, Color color) throws IOException {
            stream.setNonStrokingColor(color);
            stream.addRect(x, atY, width, height);
            stream.fill();
        }

        /** Tronque le texte avec « … » s'il dépasse la largeur disponible. */
        String fit(String value, float size, float maxWidth) throws IOException {
            String safe = sanitize(regular, value);
            if (width(regular, safe, size) <= maxWidth) {
                return safe;
            }
            while (!safe.isEmpty() && width(regular, safe + "…", size) > maxWidth) {
                safe = safe.substring(0, safe.length() - 1);
            }
            return safe + "…";
        }

        private static float width(PDType0Font font, String value, float size) throws IOException {
            return font.getStringWidth(value) / 1000 * size;
        }

        private static List<String> wrap(PDType0Font font, String value, float size, float maxWidth)
                throws IOException {
            List<String> lines = new ArrayList<>();
            StringBuilder current = new StringBuilder();
            for (String word : value.split(" ")) {
                String candidate = current.isEmpty() ? word : current + " " + word;
                if (width(font, candidate, size) > maxWidth && !current.isEmpty()) {
                    lines.add(current.toString());
                    current = new StringBuilder(word);
                } else {
                    current = new StringBuilder(candidate);
                }
            }
            if (!current.isEmpty()) {
                lines.add(current.toString());
            }
            return lines;
        }

        /** Remplace les caractères absents de la police (et les caractères de contrôle) par « ? ». */
        private static String sanitize(PDType0Font font, String value) {
            if (value == null) {
                return "";
            }
            StringBuilder sb = new StringBuilder(value.length());
            value.codePoints().forEach(cp -> {
                String ch = new String(Character.toChars(cp));
                if (Character.isISOControl(cp)) {
                    sb.append(' ');
                    return;
                }
                try {
                    font.encode(ch);
                    sb.append(ch);
                } catch (IOException | IllegalArgumentException e) {
                    sb.append('?');
                }
            });
            return sb.toString();
        }
    }
}
