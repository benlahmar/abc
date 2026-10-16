package com.universite.esign;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import com.universite.esign.signature.PadesValidationService;
import com.universite.esign.signature.PadesValidationService.SignatureReport;
import eu.europa.esig.dss.enumerations.SignatureLevel;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DocumentApiIntegrationTest {

    private static final String ATTESTATION = """
            {
              "type": "ATTESTATION_SCOLARITE",
              "student": {
                "cne": "R130456789", "nom": "El Amrani", "prenom": "Yasmine",
                "dateNaissance": "2003-05-14", "lieuNaissance": "Fès",
                "filiere": "Sciences Mathématiques et Informatique", "niveau": "Licence 3"
              },
              "academicYear": "2025-2026"
            }
            """;

    private static final String RELEVE = """
            {
              "type": "RELEVE_NOTES",
              "student": {
                "cne": "R130456789", "nom": "El Amrani", "prenom": "Yasmine",
                "filiere": "Sciences Mathématiques et Informatique", "niveau": "Licence 3"
              },
              "academicYear": "2025-2026",
              "semester": "S5",
              "grades": [
                {"code": "M51", "intitule": "Réseaux informatiques", "note": 14.5, "credits": 6},
                {"code": "M52", "intitule": "Bases de données avancées", "note": 9.25, "credits": 6},
                {"code": "M53", "intitule": "Génie logiciel", "note": 16, "credits": 4, "resultat": "V"}
              ]
            }
            """;

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper json;

    @Autowired
    PadesValidationService validator;

    private static JwtRequestPostProcessor client(String clientId, String scopes) {
        return jwt().jwt(j -> j.claim("azp", clientId).claim("scope", scopes));
    }

    private JsonNode create(String body, String clientId) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/documents")
                        .with(client(clientId, "documents:write documents:read documents:revoke"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }

    private byte[] download(String id, String clientId) throws Exception {
        return mvc.perform(get("/api/v1/documents/{id}/download", id).with(client(clientId, "documents:read")))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andReturn().getResponse().getContentAsByteArray();
    }

    @Test
    void createsSignedAttestationWithValidPadesSignature() throws Exception {
        JsonNode doc = create(ATTESTATION, "scolarite-app");
        assertThat(doc.get("status").asString()).isEqualTo("SIGNED");
        assertThat(doc.get("signatureLevel").asString()).isEqualTo("PAdES_BASELINE_B");
        assertThat(doc.get("verificationCode").asString()).matches("([0-9A-Z]{5}-){3}[0-9A-Z]{5}");

        byte[] pdf = download(doc.get("id").asString(), "scolarite-app");
        List<SignatureReport> signatures = validator.validate(pdf);
        assertThat(signatures).hasSize(1);
        assertThat(signatures.getFirst().cryptographicallyValid()).isTrue();
        assertThat(signatures.getFirst().format()).isEqualTo(SignatureLevel.PAdES_BASELINE_B.name());

        try (PDDocument pd = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(pd);
            assertThat(text).contains("ATTESTATION DE SCOLARITÉ", "EL AMRANI Yasmine", "Fès",
                    doc.get("verificationCode").asString());
        }
    }

    @Test
    void createsTranscriptWithWeightedAverage() throws Exception {
        JsonNode doc = create(RELEVE, "scolarite-app");
        byte[] pdf = download(doc.get("id").asString(), "scolarite-app");
        try (PDDocument pd = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(pd);
            // (14.5*6 + 9.25*6 + 16*4) / 16 = 12.91
            assertThat(text).contains("RELEVÉ DE NOTES", "Réseaux informatiques", "12.91", "Validé");
        }
        assertThat(validator.validate(pdf)).singleElement()
                .extracting(SignatureReport::cryptographicallyValid).isEqualTo(true);
    }

    @Test
    void transcriptWithoutGradesIsRejected() throws Exception {
        String body = RELEVE.replaceAll("(?s)\"grades\": \\[.*?]", "\"grades\": []");
        mvc.perform(post("/api/v1/documents").with(client("scolarite-app", "documents:write"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invalidGradeIsRejected() throws Exception {
        mvc.perform(post("/api/v1/documents").with(client("scolarite-app", "documents:write"))
                        .contentType(MediaType.APPLICATION_JSON).content(RELEVE.replace("14.5", "24")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validationErrorsListEachInvalidField() throws Exception {
        String body = ATTESTATION.replace("2003-05-14", "2999-01-01").replace("\"2025-2026\"", "\"2025\"");
        mvc.perform(post("/api/v1/documents").with(client("scolarite-app", "documents:write"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.length()").value(2))
                .andExpect(jsonPath("$.errors[*].field").value(org.hamcrest.Matchers.containsInAnyOrder(
                        "student.dateNaissance", "academicYear")));

        mvc.perform(post("/api/v1/documents").with(client("scolarite-app", "documents:write"))
                        .contentType(MediaType.APPLICATION_JSON).content(ATTESTATION.replace("ATTESTATION_SCOLARITE", "X")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.cause").value(org.hamcrest.Matchers.containsString("DocumentType")));
    }

    @Test
    void idempotencyKeyReturnsSameDocumentAndRejectsDifferentPayload() throws Exception {
        String key = "idem-" + UUID.randomUUID();
        MvcResult first = mvc.perform(post("/api/v1/documents").with(client("scolarite-app", "documents:write"))
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(ATTESTATION))
                .andExpect(status().isCreated()).andReturn();
        String id = json.readTree(first.getResponse().getContentAsString()).get("id").asString();

        mvc.perform(post("/api/v1/documents").with(client("scolarite-app", "documents:write"))
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(ATTESTATION))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));

        mvc.perform(post("/api/v1/documents").with(client("scolarite-app", "documents:write"))
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(ATTESTATION.replace("Licence 3", "Master 1")))
                .andExpect(status().isConflict());
    }

    @Test
    void securityRequiresTokenAndScopes() throws Exception {
        mvc.perform(post("/api/v1/documents").contentType(MediaType.APPLICATION_JSON).content(ATTESTATION))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/documents").with(client("moodle-app", "documents:read"))
                        .contentType(MediaType.APPLICATION_JSON).content(ATTESTATION))
                .andExpect(status().isForbidden());
    }

    @Test
    void clientCannotReadAnotherClientsDocumentUnlessAdmin() throws Exception {
        String id = create(ATTESTATION, "scolarite-app").get("id").asString();
        mvc.perform(get("/api/v1/documents/{id}", id).with(client("autre-app", "documents:read")))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/documents/{id}", id).with(client("admin-app", "documents:admin")))
                .andExpect(status().isOk());
    }

    @Test
    void publicVerificationByCodeAndFile() throws Exception {
        JsonNode doc = create(ATTESTATION, "scolarite-app");
        String code = doc.get("verificationCode").asString();

        // Sans authentification, saisie manuelle en minuscules et sans tirets
        mvc.perform(get("/api/v1/verify/{code}", code.replace("-", "").toLowerCase()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authentic").value(true))
                .andExpect(jsonPath("$.document.studentName").value("EL AMRANI Yasmine"))
                .andExpect(jsonPath("$.document.studentCne").value("R1******89"));

        mvc.perform(get("/verify/{code}", code))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Document authentique")));

        byte[] pdf = download(doc.get("id").asString(), "scolarite-app");
        mvc.perform(multipart("/api/v1/verify").file(new MockMultipartFile("file", "a.pdf", "application/pdf", pdf)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authentic").value(true))
                .andExpect(jsonPath("$.contentMatches").value(true))
                .andExpect(jsonPath("$.signatures[0].cryptographicallyValid").value(true));

        // Fichier modifié (octets ajoutés) : il ne correspond plus à l'original enregistré
        byte[] tampered = concat(pdf, "\n%modif\n".getBytes(StandardCharsets.US_ASCII));
        mvc.perform(multipart("/api/v1/verify").file(new MockMultipartFile("file", "b.pdf", "application/pdf", tampered)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authentic").value(false))
                .andExpect(jsonPath("$.contentMatches").value(false));

        mvc.perform(multipart("/api/v1/verify").file(new MockMultipartFile("file", "c.txt", "text/plain",
                        "pas un pdf".getBytes(StandardCharsets.UTF_8))))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/v1/verify/{code}", "AAAAA-BBBBB-CCCCC-DDDDD"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authentic").value(false))
                .andExpect(jsonPath("$.registered").value(false));
    }

    @Test
    void revokedDocumentIsNoLongerAuthentic() throws Exception {
        JsonNode doc = create(ATTESTATION, "scolarite-app");
        String id = doc.get("id").asString();

        mvc.perform(post("/api/v1/documents/{id}/revoke", id)
                        .with(client("scolarite-app", "documents:revoke"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"Erreur de saisie\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVOKED"));

        mvc.perform(post("/api/v1/documents/{id}/revoke", id)
                        .with(client("scolarite-app", "documents:revoke"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"Encore\"}"))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/v1/verify/{code}", doc.get("verificationCode").asString()))
                .andExpect(jsonPath("$.authentic").value(false))
                .andExpect(jsonPath("$.document.status").value("REVOKED"));

        mvc.perform(get("/api/v1/audit/documents/{id}", id).with(client("audit-app", "audit:read")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventType").value("DOCUMENT_SIGNED"))
                .andExpect(jsonPath("$[1].eventType").value("DOCUMENT_REVOKED"));
        mvc.perform(get("/api/v1/audit/verify").with(client("audit-app", "audit:read")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true));
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] out = new byte[a.length + b.length];
        System.arraycopy(a, 0, out, 0, a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }
}
